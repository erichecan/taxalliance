// 核心链落库：收单 → OCR → 分类。全程走状态机（assertTransition）+ 写 AuditLog。
// DB + Provider 编排层，不含 HTTP/Next。上传路由与后台任务都调这里。
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertTransition, rollupConfidence, type Confidence, type DocSource, type DocStatus } from "@/domain";
import { fileHash, validateUpload } from "@/lib/intake/file-validation";
import {
  classifyLine,
  getClassifier,
  getOcrProvider,
  getStorageProvider,
  storageKeyFor,
  type GlAccountRef,
  type RuleLike,
} from "@/lib/providers";

const SYSTEM_USER = "system";

async function audit(
  firmId: string,
  userId: string,
  documentId: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await prisma.auditLog.create({
    data: { firmId, userId, documentId, action, detail: detail as Prisma.InputJsonValue },
  });
}

type DocLite = { id: string; firmId: string; status: string };

// 单步状态跃迁：断言合法 → 更新 → 审计。本地 doc.status 同步，供链式调用。
async function transitionTo(
  doc: DocLite,
  to: DocStatus,
  userId: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  assertTransition(doc.status as DocStatus, to);
  await prisma.document.update({ where: { id: doc.id }, data: { status: to } });
  await audit(doc.firmId, userId, doc.id, `status:${doc.status}->${to}`, detail);
  doc.status = to;
}

export type IngestInput = {
  firmId: string;
  clientId: string;
  source: DocSource;
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  userId?: string;
};

export type IngestResult = { documentId: string; duplicate: boolean };

// 收单：校验 → 指纹去重 → 存储 → 建 Document(received)。
export async function ingestDocument(input: IngestInput): Promise<IngestResult> {
  const v = validateUpload({ fileName: input.fileName, mimeType: input.mimeType, size: input.bytes.byteLength });
  if (!v.ok) throw new Error(v.error);

  const hash = fileHash(input.bytes);
  const existing = await prisma.document.findUnique({
    where: { firmId_fileHash: { firmId: input.firmId, fileHash: hash } },
  });
  if (existing) return { documentId: existing.id, duplicate: true };

  const storageKey = storageKeyFor(input.clientId, hash, input.fileName);
  await getStorageProvider().put(storageKey, input.bytes, input.mimeType);

  const doc = await prisma.document.create({
    data: {
      firmId: input.firmId,
      clientId: input.clientId,
      source: input.source,
      fileName: input.fileName,
      mimeType: input.mimeType,
      storageKey,
      fileHash: hash,
      status: "received",
    },
  });
  await audit(input.firmId, input.userId ?? SYSTEM_USER, doc.id, "ingest", { fileName: input.fileName });
  return { documentId: doc.id, duplicate: false };
}

export type ProcessResult = { status: DocStatus; lines: number; docConfidence?: Confidence };

// 处理：OCR → Extraction，逐行分类 → LineItem，落到 needs_review。
export async function processDocument(documentId: string, userId = SYSTEM_USER): Promise<ProcessResult> {
  const record = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });
  const doc: DocLite = { id: record.id, firmId: record.firmId, status: record.status };

  // 客户科目表：既是分类候选，也作为 Veryfi categories（文档级分类建议）。
  const accounts: GlAccountRef[] = (
    await prisma.glAccountCache.findMany({ where: { clientId: record.clientId } })
  ).map((a) => ({ qboAccountId: a.qboAccountId, name: a.name, accountType: a.accountType }));

  await transitionTo(doc, "ocr_processing", userId);

  let ocr;
  try {
    const bytes = await getStorageProvider().get(record.storageKey);
    ocr = await getOcrProvider().extract({
      bytes,
      fileName: record.fileName,
      mimeType: record.mimeType,
      categories: accounts.map((a) => a.name),
    });
  } catch (e) {
    await transitionTo(doc, "ocr_failed", userId, { error: e instanceof Error ? e.message : String(e) });
    return { status: "ocr_failed", lines: 0 };
  }

  await prisma.extraction.create({
    data: {
      documentId,
      rawJson: ocr.raw as Prisma.InputJsonValue,
      vendorName: ocr.vendorName,
      invoiceNo: ocr.invoiceNo,
      txnDate: ocr.txnDate ? new Date(ocr.txnDate) : null,
      dueDate: ocr.dueDate ? new Date(ocr.dueDate) : null,
      currency: ocr.currency,
      subTotal: ocr.subTotal,
      taxAmount: ocr.taxAmount,
      total: ocr.total,
      fieldConfidence: ocr.fieldConfidence as Prisma.InputJsonValue,
    },
  });
  await transitionTo(doc, "ocr_done", userId);
  await transitionTo(doc, "classifying", userId);

  const rules: RuleLike[] = (
    await prisma.classificationRule.findMany({
      where: { firmId: record.firmId, OR: [{ clientId: record.clientId }, { clientId: null }] },
    })
  ).map((r) => ({
    matchType: r.matchType as RuleLike["matchType"],
    matchValue: r.matchValue,
    glAccountId: r.glAccountId,
    glAccountName: r.glAccountName,
  }));

  // Veryfi 文档级分类建议 → 映射到本地科目（按名字），作分类兜底。
  const suggAcct = ocr.suggestedCategory
    ? accounts.find((a) => a.name === ocr.suggestedCategory!.value)
    : undefined;
  const suggestedCategory =
    suggAcct && ocr.suggestedCategory
      ? { glAccountId: suggAcct.qboAccountId, glAccountName: suggAcct.name, score: ocr.suggestedCategory.score }
      : null;

  const classifier = getClassifier();
  const confidences: Confidence[] = [];
  for (const line of ocr.lines) {
    const c = await classifyLine(
      {
        description: line.description,
        amount: line.amount,
        vendorName: ocr.vendorName,
        accounts,
        suggestedCategory,
      },
      rules,
      classifier,
    );
    confidences.push(c.confidence);
    await prisma.lineItem.create({
      data: {
        documentId,
        description: line.description,
        amount: line.amount,
        glAccountId: c.glAccountId,
        glAccountName: c.glAccountName,
        confidence: c.confidence,
      },
    });
  }

  // 文档级 confidence 派生（契约 §4.7），仅入审计，不物化在 Document 上。
  const docConfidence = rollupConfidence(confidences.length ? confidences : ["low"]);
  await transitionTo(doc, "needs_review", userId, { lines: ocr.lines.length, docConfidence });

  return { status: "needs_review", lines: ocr.lines.length, docConfidence };
}
