"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clients, firm } from "@/lib/mock";

export function Sidebar() {
  const path = usePathname();
  const activeClient = path.match(/\/clients\/(c-\d+)/)?.[1];

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid size-9 place-items-center rounded-lg bg-ink-700 font-display text-lg font-bold text-white">
          易
        </div>
        <div className="leading-tight">
          <div className="font-display text-[15px] font-bold text-ink-900">
            {firm.name}
          </div>
          <div className="text-[11px] tracking-wide text-faint">
            {firm.product} · {firm.en}
          </div>
        </div>
      </div>

      <Link
        href="/clients"
        className={`mx-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          path === "/clients"
            ? "bg-ink-700/10 text-ink-700"
            : "text-muted hover:bg-paper hover:text-ink-900"
        }`}
      >
        <span className="text-base">◧</span> 全部客户
      </Link>

      <div className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-faint">
        客户
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {clients.map((c) => {
          const active = activeClient === c.id;
          const pending = c.stats.inbox + c.stats.review;
          return (
            <Link
              key={c.id}
              href={`/clients/${c.id}/documents`}
              className={`group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-ink-700/10 text-ink-900"
                  : "text-muted hover:bg-paper hover:text-ink-900"
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    c.qboConnected ? "bg-conf-high" : "bg-line-strong"
                  }`}
                />
                <span className="truncate">{c.name}</span>
              </span>
              {pending > 0 && (
                <span className="tnum shrink-0 rounded-full bg-gold-50 px-1.5 text-[11px] font-semibold text-gold-700">
                  {pending}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-full bg-ink-700/10 text-sm font-semibold text-ink-700">
            陈
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium text-ink-900">陈会计</div>
            <div className="text-[11px] text-faint">高级会计师 · CPA</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
