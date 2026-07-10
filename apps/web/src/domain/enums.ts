// 其余共享枚举 —— 单一来源（数据契约 G7）。

export const CONFIDENCES = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

// 文档级 confidence 由行/字段置信度取「最差」派生（契约 §4.7），不物化在 Document 上。
export function rollupConfidence(parts: Confidence[]): Confidence {
  if (parts.includes("low")) return "low";
  if (parts.includes("medium")) return "medium";
  return "high";
}

export const DOC_SOURCES = ["email", "upload"] as const;
export type DocSource = (typeof DOC_SOURCES)[number];

export const USER_ROLES = ["accountant", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// 银行流水对账：人工/自动关联状态（契约 §4.6）。matchedDocumentId 为 canonical。
export const MATCH_STATUSES = ["unmatched", "auto", "manual", "ignored"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const RULE_MATCH_TYPES = ["vendor", "keyword"] as const;
export type RuleMatchType = (typeof RULE_MATCH_TYPES)[number];

// 客户专属收单邮箱派生规则（契约 §4.3）：clientId 原样、保留连字符。
export function inboundEmailFor(clientId: string, domain = "inbound.easetax.ca"): string {
  return `client-${clientId}@${domain}`;
}
