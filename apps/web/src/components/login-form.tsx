"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@easetax.ca");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? `登录失败 (${res.status})`);
        return;
      }
      router.replace("/clients");
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-3">
      <div>
        <label className="block text-xs font-medium text-muted">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-600"
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink-900 outline-none focus:border-ink-600"
          autoComplete="current-password"
        />
      </div>
      {error && <div className="rounded-lg bg-conf-low-bg px-3 py-2 text-xs text-conf-low">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-ink-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
      >
        {loading ? "登录中…" : "登录"}
      </button>
    </form>
  );
}
