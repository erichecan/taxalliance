"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Client, DocumentRec, DocStatus, Confidence } from "@/lib/types";

const STATUS_META: Record<DocStatus, { label: string; cls: string }> = {
  received: { label: "新到", cls: "bg-paper text-muted" },
  ocr_processing: { label: "识别中", cls: "bg-gold-50 text-gold-700" },
  ocr_done: { label: "识别完成", cls: "bg-gold-50 text-gold-700" },
  classifying: { label: "分类中", cls: "bg-gold-50 text-gold-700" },
  needs_review: { label: "待复核", cls: "bg-gold-50 text-gold-700" },
  confirmed: { label: "已确认", cls: "bg-conf-high-bg text-conf-high" },
  syncing_qbo: { label: "录入中", cls: "bg-gold-50 text-gold-700" },
  synced: { label: "已录入", cls: "bg-conf-high-bg text-conf-high" },
  duplicate_suspected: { label: "疑似重复", cls: "bg-conf-low-bg text-conf-low" },
  ocr_failed: { label: "识别失败", cls: "bg-conf-low-bg text-conf-low" },
  sync_failed: { label: "录入失败", cls: "bg-conf-low-bg text-conf-low" },
  rejected: { label: "已退回", cls: "bg-conf-low-bg text-conf-low" },
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

const IN_PIPELINE: DocStatus[] = ["received", "ocr_processing", "ocr_done", "classifying"];
const EXCEPTION: DocStatus[] = ["duplicate_suspected", "ocr_failed", "sync_failed", "rejected"];

function inTab(tab: Tab, s: DocStatus) {
  if (tab === "all") return true;
  if (tab === "needs_review") return s === "needs_review" || IN_PIPELINE.includes(s);
  if (tab === "synced") return s === "synced" || s === "confirmed" || s === "syncing_qbo";
  return EXCEPTION.includes(s);
}

const STEPS = ["上传到存储", "Veryfi OCR 识别", "AI 分类到 GL 科目"];

function statusNotice(status: string): string {
  if (status === "needs_review") return "✓ 已识别并分类，见「待复核」";
  if (status === "ocr_failed") return "✗ OCR 识别失败，见「异常」";
  return `✓ 已处理（${status}）`;
}

export function DocumentQueue({ client, docs }: { client: Client; docs: DocumentRec[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [justUploadedId, setJustUploadedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const rows = docs.filter((d) => inTab(tab, d.status));

  async function uploadFile(file: File) {
    if (busy) return;
    setBusy(true);
    setFileName(file.name);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("clientId", client.id);
      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(`✗ ${j.error ?? "上传失败"}`);
        return;
      }
      setJustUploadedId(j.documentId ?? null);
      setNotice(j.duplicate ? "⚠ 该文件疑似重复，未重复入账" : statusNotice(j.status));
      setTab(j.duplicate ? "exception" : "needs_review");
      router.refresh();
    } catch {
      setNotice("✗ 网络错误");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const noticeCls = notice?.startsWith("✓")
    ? "bg-conf-high-bg text-conf-high"
    : "bg-conf-low-bg text-conf-low";

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-ink-900">{client.name}</h1>
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
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/clients/${client.id}/reconciliation`}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink-900"
          >
            银行对账
          </Link>
          <Link
            href={`/clients/${client.id}/settings`}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-ink-900"
          >
            设置
          </Link>
        </div>
      </header>

      {/* 收单入口：真实上传 → 后端 OCR + 分类 */}
      <div className="mt-6">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
        {busy ? (
          <div className="rounded-xl border border-line bg-surface p-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-ink-900">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-line border-t-ink-700" />
              正在处理 {fileName}…
            </div>
            <ol className="space-y-2">
              {STEPS.map((s) => (
                <li key={s} className="flex items-center gap-2.5 text-sm text-muted">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-gold-50 text-[11px] font-bold text-gold-700">
                    ⋯
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="group flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-surface px-5 py-6 text-sm transition-colors hover:border-ink-600 hover:bg-paper"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-ink-700/8 text-lg text-ink-700">
              ⬆
            </span>
            <span className="text-left">
              <span className="block font-medium text-ink-900">
                点击上传单据（PDF / 图片 / 扫描件）
              </span>
              <span className="block text-[11px] text-faint">
                上传后自动走「Veryfi 识别 → AI 分类」，产生一张待复核单据
              </span>
            </span>
          </button>
        )}
        {notice && !busy && (
          <div className={`mt-2 rounded-lg px-3 py-2 text-xs ${noticeCls}`}>{notice}</div>
        )}
      </div>

      <div className="mt-6 flex gap-1 rounded-lg border border-line bg-surface p-1">
        {TABS.map((t) => {
          const count = docs.filter((d) => inTab(t.key, d.status)).length;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active ? "bg-ink-700 text-white" : "text-muted hover:bg-paper hover:text-ink-900"
              }`}
            >
              {t.label}
              <span className={`tnum ml-1.5 text-xs ${active ? "text-white/70" : "text-faint"}`}>
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
              const isNew = d.id === justUploadedId;
              return (
                <tr
                  key={d.id}
                  className={`border-b border-line last:border-0 transition-colors hover:bg-paper ${
                    isNew ? "rise bg-gold-50/40" : ""
                  }`}
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
                          {isNew && (
                            <span className="ml-2 rounded bg-gold-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              新
                            </span>
                          )}
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
