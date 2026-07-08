export type Confidence = "high" | "medium" | "low";

export type DocStatus =
  | "received"
  | "processing"
  | "needs_review"
  | "confirmed"
  | "syncing"
  | "synced"
  | "duplicate"
  | "failed";

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
