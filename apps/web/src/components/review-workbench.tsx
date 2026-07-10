"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Client, DocumentRec, GlAccount, LineItem, Confidence } from "@/lib/types";

const money = (n: number) =>
  n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

const CONF_META: Record<Confidence, { label: string; dot: string; text: string; bg: string }> = {
  high: { label: "高", dot: "bg-conf-high", text: "text-conf-high", bg: "bg-conf-high-bg" },
  medium: { label: "中", dot: "bg-conf-med", text: "text-conf-med", bg: "bg-conf-med-bg" },
  low: { label: "低", dot: "bg-conf-low", text: "text-conf-low", bg: "bg-conf-low-bg" },
};

const confRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

export function ReviewWorkbench({
  doc,
  client,
  accounts,
  ocrText,
}: {
  doc: DocumentRec;
  client: Client;
  accounts: GlAccount[];
  ocrText?: string | null;
}) {
  const [lines, setLines] = useState<LineItem[]>(() =>
    [...doc.lines].sort((a, b) => confRank[a.confidence] - confRank[b.confidence]),
  );

  const setAccount = (lineId: string, accId: string) => {
    const acc = accounts.find((a) => a.id === accId);
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? {
              ...l,
              glAccountId: acc?.id ?? null,
              glAccountName: acc?.name ?? null,
              confidence: acc ? "high" : l.confidence,
            }
          : l,
      ),
    );
  };

  const assignedTotal = useMemo(
    () => lines.reduce((s, l) => s + l.amount, 0),
    [lines],
  );
  const allAssigned = lines.length > 0 && lines.every((l) => l.glAccountId);

  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origMode, setOrigMode] = useState<"raw" | "summary">("raw");
  const [copied, setCopied] = useState(false);

  async function copyOcr() {
    const text = ocrText ?? "";
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      // 兜底：临时 textarea + execCommand（旧浏览器/非安全上下文）
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 1500);
    } else {
      setError("复制失败，请手动选中复制");
    }
  }

  async function confirm() {
    if (!allAssigned || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignments: lines.map((l) => ({ lineId: l.id, glAccountId: l.glAccountId })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? `确认失败 (${res.status})`);
        return;
      }
      router.push(`/clients/${client.id}/documents`);
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/clients/${client.id}/documents`}
            className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-paper hover:text-ink-900"
          >
            ← 队列
          </Link>
          <div className="h-4 w-px bg-line" />
          <div>
            <div className="font-medium text-ink-900">{doc.vendor}</div>
            <div className="text-[11px] text-faint">
              {client.name} · {doc.invoiceNo} · {doc.txnDate}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-conf-low">{error}</span>}
          <button className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink-900">
            退回
          </button>
          <button
            onClick={confirm}
            disabled={!allAssigned || saving}
            className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "确认中…" : allAssigned ? "确认分类" : "尚有未分类行"}
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden bg-line lg:grid-cols-[1fr_1.4fr_1fr]">
        {/* 左：原件预览 */}
        <section className="overflow-y-auto bg-paper p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">原件</span>
            <div className="flex gap-1 rounded-md border border-line bg-surface p-0.5">
              <button
                onClick={() => setOrigMode("raw")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  origMode === "raw" ? "bg-ink-700 text-white" : "text-muted hover:text-ink-900"
                }`}
              >
                识别原文
              </button>
              <button
                onClick={() => setOrigMode("summary")}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  origMode === "summary" ? "bg-ink-700 text-white" : "text-muted hover:text-ink-900"
                }`}
              >
                摘要
              </button>
            </div>
          </div>
          {origMode === "raw" && (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-faint">Veryfi 识别原文（全文）</span>
                <button
                  onClick={copyOcr}
                  disabled={!ocrText}
                  className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] font-medium text-muted transition-colors hover:text-ink-900 disabled:opacity-40"
                >
                  {copied ? "已复制 ✓" : "复制原文"}
                </button>
              </div>
              <pre
                className="max-h-[calc(100vh-13rem)] overflow-auto whitespace-pre rounded-lg border border-line bg-surface p-4 font-mono text-[11px] leading-relaxed text-ink-900"
                style={{ tabSize: 4 }}
              >
                {ocrText ?? "（无识别原文）"}
              </pre>
            </>
          )}
          {origMode === "summary" && (
          <div className="rounded-lg border border-line bg-surface p-5 shadow-[0_1px_8px_-4px_rgba(31,77,63,0.12)]">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <span className="font-display text-lg font-bold text-ink-900">
                {doc.vendor}
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  doc.fileKind === "pdf"
                    ? "bg-conf-low-bg text-conf-low"
                    : "bg-conf-high-bg text-conf-high"
                }`}
              >
                {doc.fileKind === "pdf" ? "PDF" : "IMG"}
              </span>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k="发票号" v={doc.invoiceNo} mono />
              <Row k="账单日" v={doc.txnDate} mono />
              <Row k="到期日" v={doc.dueDate} mono />
            </dl>
            <div className="mt-4 border-t border-line pt-3">
              {doc.lines.map((l) => (
                <div key={l.id} className="flex justify-between py-1 text-sm">
                  <span className="text-muted">{l.description}</span>
                  <span className="tnum text-ink-900">{money(l.amount)}</span>
                </div>
              ))}
            </div>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <Row k="小计" v={money(doc.subTotal)} />
              <Row k={doc.taxLabel} v={money(doc.tax)} />
              <div className="flex justify-between pt-1 font-semibold text-ink-900">
                <span>合计</span>
                <span className="tnum">{money(doc.total)}</span>
              </div>
            </dl>
            <div className="mt-4 truncate text-[11px] text-faint">
              📎 {doc.fileName}
            </div>
          </div>
          )}
          {doc.note && (
            <div className="mt-3 rounded-lg bg-conf-low-bg px-3 py-2 text-xs text-conf-low">
              ⚠ {doc.note}
            </div>
          )}
        </section>

        {/* 中：识别 + 分类 */}
        <section className="overflow-y-auto bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
              识别结果 · 分类
            </span>
            <span className="text-[11px] text-faint">
              低置信度行已置顶
            </span>
          </div>
          <div className="space-y-2.5">
            {lines.map((l) => {
              const c = CONF_META[l.confidence];
              return (
                <div
                  key={l.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    l.confidence === "low" && !l.glAccountId
                      ? "border-conf-low/40 bg-conf-low-bg/40"
                      : "border-line bg-surface"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink-900">
                        {l.description}
                      </div>
                      <div className="tnum mt-0.5 text-xs text-muted">
                        {money(l.amount)} · {l.taxCode}
                      </div>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.bg} ${c.text}`}
                    >
                      <span className={`size-1.5 rounded-full ${c.dot}`} /> {c.label}
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <select
                      value={l.glAccountId ?? ""}
                      onChange={(e) => setAccount(l.id, e.target.value)}
                      className={`w-full rounded-md border bg-surface px-2.5 py-1.5 text-sm text-ink-900 transition-colors focus:border-ink-600 ${
                        l.glAccountId ? "border-line" : "border-conf-low/50"
                      }`}
                    >
                      <option value="">— 选择 GL 科目 —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
            {lines.length === 0 && (
              <div className="rounded-lg border border-dashed border-line py-10 text-center text-sm text-faint">
                该单据尚未产生行项目（OCR 未完成）
              </div>
            )}
          </div>
        </section>

        {/* 右：Bill 预览 */}
        <section className="overflow-y-auto bg-paper p-5">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
            将写入 QBO 的 Bill
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <div className="text-[11px] text-faint">Vendor</div>
                <div className="font-medium text-ink-900">{doc.vendor}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-faint">DocNumber</div>
                <div className="tnum font-mono text-sm text-ink-900">
                  {doc.invoiceNo}
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {lines.map((l) => (
                <div key={l.id} className="text-sm">
                  <div className="flex justify-between">
                    <span
                      className={
                        l.glAccountName ? "text-ink-900" : "text-conf-low"
                      }
                    >
                      {l.glAccountName ?? "未分类"}
                    </span>
                    <span className="tnum text-ink-900">{money(l.amount)}</span>
                  </div>
                  <div className="truncate text-[11px] text-faint">
                    {l.description}
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              <Row k="行项目合计" v={money(assignedTotal)} />
              <Row k={doc.taxLabel} v={money(doc.tax)} />
              <div className="flex justify-between pt-1 font-semibold text-ink-900">
                <span>Bill 总额</span>
                <span className="tnum">{money(assignedTotal + doc.tax)}</span>
              </div>
            </dl>
          </div>
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              allAssigned
                ? "bg-conf-high-bg text-conf-high"
                : "bg-conf-med-bg text-conf-med"
            }`}
          >
            {allAssigned
              ? "✓ 全部行已分类，可录入。原件将作为 Attachable 附件挂到 Bill。"
              : "还有行未选择 GL 科目，录入按钮已锁定。"}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-faint">{k}</span>
      <span className={`text-ink-900 ${mono ? "font-mono text-xs" : "tnum"}`}>
        {v}
      </span>
    </div>
  );
}
