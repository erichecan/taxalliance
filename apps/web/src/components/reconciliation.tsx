"use client";

import { useState } from "react";
import Link from "next/link";
import type { Client, ReconRow } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

export function Reconciliation({
  client,
  rows,
  month,
}: {
  client: Client;
  rows: ReconRow[];
  month: string;
}) {
  const [reminded, setReminded] = useState<Set<string>>(new Set());

  const missing = rows.filter((r) => !r.matchedDocId);
  const matched = rows.filter((r) => r.matchedDocId);
  const totalSpend = rows.reduce((s, r) => s + r.txn.amount, 0);
  const missingSpend = missing.reduce((s, r) => s + r.txn.amount, 0);

  const remind = (id: string) =>
    setReminded((prev) => new Set(prev).add(id));

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/clients/${client.id}/documents`}
            className="text-sm text-muted transition-colors hover:text-ink-900"
          >
            ← {client.name} · 单据队列
          </Link>
          <h1 className="mt-2 font-display text-2xl font-bold text-ink-900">
            银行对账 · {month}
          </h1>
          <p className="mt-1 text-sm text-muted">
            把银行流水逐笔和本月已收单据对照，找出没有收据支撑的支出。
          </p>
        </div>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Tile label="本月银行支出" value={`${rows.length} 笔`} sub={money(totalSpend)} tone="text-ink-900" />
        <Tile label="已匹配收据" value={`${matched.length} 笔`} sub="有收据支撑" tone="text-conf-high" />
        <Tile
          label="缺收据"
          value={`${missing.length} 笔`}
          sub={money(missingSpend)}
          tone="text-conf-low"
          highlight
        />
      </div>

      {/* 缺收据清单 —— 核心产出 */}
      <section className="mt-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-ink-900">
            缺收据清单
          </h2>
          <span className="text-xs text-faint">
            这些银行支出找不到对应收据，需向客户追票
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-conf-low/30 bg-surface">
          {missing.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-conf-high">
              ✓ 本月每一笔银行支出都有收据支撑，无缺口。
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                  <th className="px-4 py-3 font-semibold">日期</th>
                  <th className="px-4 py-3 font-semibold">银行摘要</th>
                  <th className="px-4 py-3 text-right font-semibold">金额</th>
                  <th className="px-4 py-3 text-right font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((r) => {
                  const done = reminded.has(r.txn.id);
                  return (
                    <tr key={r.txn.id} className="border-b border-line last:border-0">
                      <td className="tnum px-4 py-3 text-muted">{r.txn.date}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-ink-900">{r.txn.description}</span>
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-conf-low-bg px-2 py-0.5 text-[10px] font-semibold text-conf-low">
                          缺收据
                        </span>
                      </td>
                      <td className="tnum px-4 py-3 text-right font-medium text-ink-900">
                        {money(r.txn.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {done ? (
                          <span className="text-xs font-medium text-conf-high">
                            ✓ 已提醒
                          </span>
                        ) : (
                          <button
                            onClick={() => remind(r.txn.id)}
                            className="rounded-md border border-line px-2.5 py-1 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-700/10"
                          >
                            提醒客户补单
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* 全部流水 */}
      <section className="mt-7">
        <h2 className="font-display text-lg font-bold text-ink-900">全部银行流水</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-faint">
                <th className="px-4 py-3 font-semibold">日期</th>
                <th className="px-4 py-3 font-semibold">银行摘要</th>
                <th className="px-4 py-3 text-right font-semibold">金额</th>
                <th className="px-4 py-3 font-semibold">对账状态</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.txn.id}
                  className="border-b border-line last:border-0 transition-colors hover:bg-paper"
                >
                  <td className="tnum px-4 py-3 text-muted">{r.txn.date}</td>
                  <td className="px-4 py-3 font-mono text-ink-900">{r.txn.description}</td>
                  <td className="tnum px-4 py-3 text-right font-medium text-ink-900">
                    {money(r.txn.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {r.matchedDocId ? (
                      <Link
                        href={`/documents/${r.matchedDocId}/review`}
                        className="inline-flex items-center gap-1.5 text-conf-high transition-colors hover:underline"
                      >
                        <span className="size-1.5 rounded-full bg-conf-high" />
                        已匹配 · {r.matchedFileName}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-conf-low">
                        <span className="size-1.5 rounded-full bg-conf-low" />
                        缺收据
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-5 ${
        highlight ? "border-conf-low/40" : "border-line"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wider text-faint">{label}</div>
      <div className={`tnum mt-1 font-display text-2xl font-bold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-xs text-faint">{sub}</div>
    </div>
  );
}
