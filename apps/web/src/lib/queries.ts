// firm-scoped 读取 + DB→视图类型映射。所有查询强制带 firmId（契约 G8）。
// stats / 文档级 confidence 一律派生（契约 G4/§4.7），不物化。
import { prisma } from "@/lib/db";
import { rollupConfidence, type Confidence, type DocStatus } from "@/domain";
import type { Client, DocumentRec, GlAccount, LineItem } from "@/lib/types";

const INBOX_STATUSES: DocStatus[] = ["received", "ocr_processing", "ocr_done", "classifying"];

function relativeTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} 天前`;
  return d.toISOString().slice(0, 10);
}

type DbDoc = {
  id: string;
  clientId: string;
  source: string;
  fileName: string;
  mimeType: string;
  status: string;
  createdAt: Date;
  extraction: {
    vendorName: string | null;
    invoiceNo: string | null;
    txnDate: Date | null;
    dueDate: Date | null;
    currency: string | null;
    subTotal: unknown;
    taxAmount: unknown;
    total: unknown;
  } | null;
  lines: {
    id: string;
    description: string;
    amount: unknown;
    glAccountId: string | null;
    glAccountName: string | null;
    taxCode: string | null;
    confidence: string;
  }[];
};

function num(v: unknown): number {
  return v == null ? 0 : Number(v);
}

function toDocumentRec(d: DbDoc): DocumentRec {
  const e = d.extraction;
  const lines: LineItem[] = d.lines.map((l) => ({
    id: l.id,
    description: l.description,
    amount: num(l.amount),
    glAccountId: l.glAccountId,
    glAccountName: l.glAccountName,
    taxCode: l.taxCode ?? "",
    confidence: l.confidence as Confidence,
  }));
  const docConfidence = rollupConfidence(lines.length ? lines.map((l) => l.confidence) : ["low"]);
  const tax = num(e?.taxAmount);
  return {
    id: d.id,
    clientId: d.clientId,
    source: d.source === "email" ? "email" : "upload",
    fileName: d.fileName,
    fileKind: d.mimeType === "application/pdf" ? "pdf" : "image",
    vendor: e?.vendorName ?? "—",
    invoiceNo: e?.invoiceNo ?? "—",
    txnDate: e?.txnDate ? e.txnDate.toISOString().slice(0, 10) : "",
    dueDate: e?.dueDate ? e.dueDate.toISOString().slice(0, 10) : "",
    currency: e?.currency ?? "CAD",
    subTotal: num(e?.subTotal),
    tax,
    taxLabel: tax > 0 ? "含税 HST" : "免税",
    total: num(e?.total),
    status: d.status as DocStatus,
    confidence: docConfidence,
    receivedAt: relativeTime(d.createdAt),
    lines,
  };
}

const DOC_INCLUDE = { extraction: true, lines: { orderBy: { id: "asc" as const } } };

async function statsByClient(firmId: string): Promise<Map<string, Client["stats"]>> {
  const groups = await prisma.document.groupBy({
    by: ["clientId", "status"],
    where: { firmId },
    _count: { _all: true },
  });
  const map = new Map<string, Client["stats"]>();
  for (const g of groups) {
    const s = map.get(g.clientId) ?? { inbox: 0, review: 0, synced: 0 };
    const n = g._count._all;
    if (g.status === "needs_review") s.review += n;
    else if (g.status === "synced") s.synced += n;
    else if (INBOX_STATUSES.includes(g.status as DocStatus)) s.inbox += n;
    map.set(g.clientId, s);
  }
  return map;
}

export async function getFirm(firmId: string): Promise<{ name: string } | null> {
  return prisma.firm.findUnique({ where: { id: firmId }, select: { name: true } });
}

export async function getClientsForFirm(firmId: string): Promise<Client[]> {
  const [clients, stats] = await Promise.all([
    prisma.client.findMany({ where: { firmId }, orderBy: { createdAt: "asc" } }),
    statsByClient(firmId),
  ]);
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    industry: c.industry ?? "",
    qboConnected: c.qboRealmId != null,
    inboundEmail: c.inboundEmail,
    stats: stats.get(c.id) ?? { inbox: 0, review: 0, synced: 0 },
  }));
}

export async function getClient(firmId: string, clientId: string): Promise<Client | null> {
  const c = await prisma.client.findFirst({ where: { id: clientId, firmId } });
  if (!c) return null;
  const stats = await statsByClient(firmId);
  return {
    id: c.id,
    name: c.name,
    industry: c.industry ?? "",
    qboConnected: c.qboRealmId != null,
    inboundEmail: c.inboundEmail,
    stats: stats.get(c.id) ?? { inbox: 0, review: 0, synced: 0 },
  };
}

export async function getClientDocuments(firmId: string, clientId: string): Promise<DocumentRec[]> {
  const docs = await prisma.document.findMany({
    where: { firmId, clientId },
    include: DOC_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return docs.map((d) => toDocumentRec(d as DbDoc));
}

export async function getDocumentForReview(
  firmId: string,
  documentId: string,
): Promise<{ doc: DocumentRec; client: Client; accounts: GlAccount[]; ocrText: string | null } | null> {
  const d = await prisma.document.findFirst({
    where: { id: documentId, firmId },
    include: DOC_INCLUDE,
  });
  if (!d) return null;
  const client = await getClient(firmId, d.clientId);
  if (!client) return null;
  const accts = await prisma.glAccountCache.findMany({
    where: { clientId: d.clientId },
    orderBy: { name: "asc" },
  });
  const accounts: GlAccount[] = accts.map((a) => ({ id: a.qboAccountId, code: a.qboAccountId, name: a.name }));
  const ocrText = (d.extraction?.rawJson as { ocr_text?: string } | null)?.ocr_text ?? null;
  return { doc: toDocumentRec(d as DbDoc), client, accounts, ocrText };
}
