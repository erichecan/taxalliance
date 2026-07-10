import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { assertTransition, type DocStatus } from "@/domain";

type Assignment = { lineId: string; glAccountId: string | null };

// 确认复核：持久化每行 GL 科目 + 学习飞轮（回写供应商规则）+ 状态 → confirmed。
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return Response.json({ error: "未授权访问" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { assignments?: Assignment[] };
  const assignments = Array.isArray(body.assignments) ? body.assignments : [];

  // firm 隔离
  const doc = await prisma.document.findFirst({
    where: { id, firmId: s.firmId },
    include: { lines: true, extraction: true },
  });
  if (!doc) return Response.json({ error: "单据不存在" }, { status: 404 });

  // 候选科目（校验分配是否合法）
  const accts = await prisma.glAccountCache.findMany({ where: { clientId: doc.clientId } });
  const acctById = new Map(accts.map((a) => [a.qboAccountId, a]));

  const assignMap = new Map(assignments.map((a) => [String(a.lineId), a.glAccountId ? String(a.glAccountId) : null]));
  const finalByLine = doc.lines.map((l) => ({
    lineId: l.id,
    glAccountId: assignMap.has(l.id) ? assignMap.get(l.id)! : l.glAccountId,
  }));

  const missing = finalByLine.filter((x) => !x.glAccountId || !acctById.has(x.glAccountId));
  if (missing.length) {
    return Response.json({ error: `还有 ${missing.length} 行未选择有效科目` }, { status: 400 });
  }

  // 持久化行分类（人工确认 → high）
  await prisma.$transaction(
    finalByLine.map((x) =>
      prisma.lineItem.update({
        where: { id: x.lineId },
        data: { glAccountId: x.glAccountId, glAccountName: acctById.get(x.glAccountId!)!.name, confidence: "high" },
      }),
    ),
  );

  // 学习飞轮：供应商已知 + 整单所有行归同一科目 → upsert 供应商规则（避免多类目噪声）。
  const vendor = doc.extraction?.vendorName?.trim();
  const uniqueAccts = new Set(finalByLine.map((x) => x.glAccountId));
  let ruleWritten = false;
  if (vendor && uniqueAccts.size === 1) {
    const acctId = [...uniqueAccts][0]!;
    const acct = acctById.get(acctId)!;
    const existing = await prisma.classificationRule.findFirst({
      where: { firmId: s.firmId, clientId: doc.clientId, matchType: "vendor", matchValue: vendor },
    });
    if (existing) {
      await prisma.classificationRule.update({
        where: { id: existing.id },
        data: { glAccountId: acctId, glAccountName: acct.name },
      });
    } else {
      await prisma.classificationRule.create({
        data: {
          firmId: s.firmId,
          clientId: doc.clientId,
          matchType: "vendor",
          matchValue: vendor,
          glAccountId: acctId,
          glAccountName: acct.name,
        },
      });
    }
    ruleWritten = true;
  }

  // 状态：needs_review → confirmed（已 confirmed 则仅重存，不再跃迁）
  if (doc.status === "needs_review") {
    assertTransition(doc.status as DocStatus, "confirmed");
    await prisma.document.update({ where: { id: doc.id }, data: { status: "confirmed" } });
  }
  await prisma.auditLog.create({
    data: {
      firmId: s.firmId,
      userId: s.userId,
      documentId: doc.id,
      action: doc.status === "needs_review" ? "status:needs_review->confirmed" : "reconfirm",
      detail: { ruleWritten, vendor: vendor ?? null } as Prisma.InputJsonValue,
    },
  });

  return Response.json({ ok: true, ruleWritten });
}
