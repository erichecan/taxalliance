"use client";

import { useState } from "react";
import Link from "next/link";
import type { Client, DocumentRec, DocStatus, Confidence } from "@/lib/types";

const STATUS_META: Record<DocStatus, { label: string; cls: string }> = {
  received: { label: "新到", cls: "bg-paper text-muted" },
  processing: { label: "识别中", cls: "bg-gold-50 text-gold-700" },
  needs_review: { label: "待复核", cls: "bg-gold-50 text-gold-700" },
  confirmed: { label: "已确认", cls: "bg-conf-high-bg text-conf-high" },
  syncing: { label: "录入中", cls: "bg-gold-50 text-gold-700" },
  synced: { label: "已录入", cls: "bg-conf-high-bg text-conf-high" },
  duplicate: { label: "疑似重复", cls: "bg-conf-low-bg text-conf-low" },
  failed: { label: "失败", cls: "bg-conf-low-bg text-conf-low" },
};

const CONF_DOT: Record<Confidence, string> = {
  high: "bg-conf-high",
  medium: "bg-conf-med",
  low: "bg-conf-low",
};

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

type Tab = "all" | "needs_review" | "synced" | "exception";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "needs_review", label: "待复核" },
  { key: "synced", label: "已录入" },
  { key: "exception", label: "异常" },
];

function inTab(tab: Tab, s: DocStatus) {
  if (tab === "all") return true;
  if (tab === "needs_review")
    return s === "needs_review" || s === "received" || s === "processing";
  if (tab === "synced") return s === "synced" || s === "confirmed";
  return s === "duplicate" || s === "failed";
}

export function DocumentQueue({
  client,
  docs,
}: {
  client: Client;
  docs: DocumentRec[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const rows = docs.filter((d) => inTab(tab, d.status));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink-900">
              {client.name}
            </h1>
            {client.qboConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-conf-high-bg px-2.5 py-0.5 text-[11px] font-medium text-conf-high">
                <span className="size-1.5 rounded-full bg-conf-high" /> QBO 已连接
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-medium text-faint">
                <span className="size-1.5 rounded-full bg-line-strong" /> 未连接
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {client.industry} · 收单邮箱{" "}
            <span className="font-mono text-ink-700">{client.inboundEmail}</span>
          </p>
        </div>
        <Link
          href={`/clients/${client.id}/settings`}
          className="shrink-0 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink-900"
        >
          设置
        </Link>
      </header>

      <div className="mt-6 flex gap-1 rounded-lg border border-line bg-surface p-1">
        {TABS.map((t) => {
          const count = docs.filter((d) => inTab(t.key, d.status)).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-ink-700 text-white"
                  : "text-muted hover:bg-paper hover:text-ink-900"
              }`}
            >
              {t.label}
              <span
                className={`tnum ml-1.5 text-xs ${active ? "text-white/70" : "text-faint"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
              <th className="px-4 py-3 font-semibold">单据</th>
              <th className="px-4 py-3 font-semibold">供应商</th>
              <th className="px-4 py-3 font-semibold">日期</th>
              <th className="px-4 py-3 text-right font-semibold">金额</th>
              <th className="px-4 py-3 font-semibold">状态</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const meta = STATUS_META[d.status];
              return (
                <tr
                  key={d.id}
                  className="border-b border-line last:border-0 transition-colors hover:bg-paper"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-md text-[11px] font-semibold ${
                          d.fileKind === "pdf"
                            ? "bg-conf-low-bg text-conf-low"
                            : "bg-conf-high-bg text-conf-high"
                        }`}
                      >
                        {d.fileKind === "pdf" ? "PDF" : "IMG"}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink-900">
                          {d.fileName}
                        </div>
                        <div className="text-[11px] text-faint">
                          {d.source === "email" ? "邮件" : "上传"} · {d.receivedAt}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-900">
                    {d.vendor}
                    <div className="text-[11px] text-faint">{d.invoiceNo}</div>
                  </td>
                  <td className="tnum px-4 py-3 text-muted">{d.txnDate}</td>
                  <td className="tnum px-4 py-3 text-right font-medium text-ink-900">
                    {money(d.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.cls}`}
                    >
                      <span className={`size-1.5 rounded-full ${CONF_DOT[d.confidence]}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(d.status === "needs_review" ||
                      d.status === "confirmed" ||
                      d.status === "synced") && (
                      <Link
                        href={`/documents/${d.id}/review`}
                        className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-700/10"
                      >
                        复核 →
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-faint">
                  该分类下暂无单据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
