// ⚠️ 枚举类型的唯一来源是 @/domain（数据契约 G7）。本文件只 re-export，
// 并保留「演示 UI 专用」的视图类型（真实 DB 版本用 Prisma 生成类型）。
export type { Confidence, DocStatus, DocSource } from "@/domain";
import type { Confidence, DocStatus } from "@/domain";

// ---- 以下为 demo/mock 的视图类型，非持久层模型 ----

export type GlAccount = {
  id: string;
  code: string;
  name: string;
};

export type LineItem = {
  id: string;
  description: string;
  amount: number;
  glAccountId: string | null;
  glAccountName: string | null;
  taxCode: string;
  confidence: Confidence;
};

export type ClientStats = {
  inbox: number;
  review: number;
  synced: number;
};

export type Client = {
  id: string;
  name: string;
  industry: string;
  qboConnected: boolean;
  inboundEmail: string;
  stats: ClientStats;
};

export type BankTxn = {
  id: string;
  clientId: string;
  date: string;
  description: string;
  amount: number;
};

export type ReconRow = {
  txn: BankTxn;
  matchedDocId: string | null;
  matchedFileName: string | null;
};

export type DocumentRec = {
  id: string;
  clientId: string;
  source: "email" | "upload";
  fileName: string;
  fileKind: "pdf" | "image";
  vendor: string;
  invoiceNo: string;
  txnDate: string;
  dueDate: string;
  currency: string;
  subTotal: number;
  tax: number;
  taxLabel: string;
  total: number;
  status: DocStatus;
  confidence: Confidence;
  receivedAt: string;
  lines: LineItem[];
  note?: string;
};
