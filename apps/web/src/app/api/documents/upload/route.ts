import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ingestDocument, processDocument } from "@/lib/pipeline/ingest";
import type { DocStatus } from "@/domain";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return Response.json({ error: "未授权访问" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const clientId = String(form?.get("clientId") ?? "");
  if (!(file instanceof File) || !clientId) {
    return Response.json({ error: "缺少文件或客户" }, { status: 400 });
  }

  // firm 隔离：客户必须属于当前 firm
  const client = await prisma.client.findFirst({ where: { id: clientId, firmId: s.firmId } });
  if (!client) return Response.json({ error: "客户不存在" }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const ing = await ingestDocument({
      firmId: s.firmId,
      clientId,
      source: "upload",
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
      userId: s.userId,
    });
    let status: DocStatus | "duplicate_suspected" = "duplicate_suspected";
    if (!ing.duplicate) {
      const r = await processDocument(ing.documentId, s.userId);
      status = r.status;
    }
    return Response.json({ documentId: ing.documentId, duplicate: ing.duplicate, status });
  } catch (e) {
    console.error("[upload] 处理失败", e);
    return Response.json({ error: e instanceof Error ? e.message : "处理失败" }, { status: 400 });
  }
}
