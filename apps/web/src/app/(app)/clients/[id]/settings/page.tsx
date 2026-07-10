import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getClient } from "@/lib/queries";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const client = await getClient(session.firmId, id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <h1 className="font-display text-2xl font-bold text-ink-900">
        {client.name} · 收单设置
      </h1>
      <p className="mt-1 text-sm text-muted">配置该客户的单据来源与记账连接</p>

      <section className="mt-7 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-medium text-ink-900">专属收单邮箱</h2>
        <p className="mt-1 text-sm text-muted">
          把这个地址给客户，让供应商直接把发票发到这里 — 邮件到达即自动进入队列。
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-paper p-1 pl-4">
          <span className="flex-1 font-mono text-sm text-ink-700">{client.inboundEmail}</span>
          <button className="rounded-md bg-ink-700 px-3 py-2 text-xs font-semibold text-white hover:bg-ink-800">
            复制
          </button>
        </div>
        <div className="mt-3 text-xs text-faint">
          支持 PDF、图片（扫描件 / 手机拍照）、HEIC。单文件上限 20MB。
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-medium text-ink-900">QuickBooks Online</h2>
            <p className="mt-1 text-sm text-muted">
              连接后，确认的单据可一键录入客户账套（创建 Bill + 附件回传）。
            </p>
          </div>
          {client.qboConnected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-conf-high-bg px-3 py-1 text-xs font-medium text-conf-high">
              <span className="size-1.5 rounded-full bg-conf-high" /> 已连接
            </span>
          ) : (
            <button className="rounded-lg bg-ink-700 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800">
              连接 QuickBooks
            </button>
          )}
        </div>
        {client.qboConnected && (
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
            <div>
              <div className="text-xs text-faint">Realm ID</div>
              <div className="font-mono text-ink-900">4620816365201{client.id.slice(-2)}</div>
            </div>
            <div>
              <div className="text-xs text-faint">授权状态</div>
              <div className="text-ink-900">有效 · 自动续期</div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-surface p-6">
        <h2 className="font-medium text-ink-900">去重</h2>
        <p className="mt-1 text-sm text-muted">
          按「供应商 + 发票号 + 金额 + 日期」自动识别重复单据，命中即标记「疑似重复」交人工确认，不会重复入账。
        </p>
      </section>
    </div>
  );
}
