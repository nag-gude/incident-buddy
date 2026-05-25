"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { DemoTokenField } from "@/components/DemoTokenField";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { getDemoToken } from "@/lib/demoToken";

type LoopStatus = {
  paused: boolean;
  last_tick_at?: string;
  last_scenario?: string;
  judge_recently_active?: boolean;
  scheduler_running?: boolean;
};

export default function AdminPage() {
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<LoopStatus>("/api/admin/loop/status");
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function pause() {
    setMessage(null);
    try {
      await apiFetch("/api/admin/loop/pause", { method: "POST" });
      setMessage("Loop paused — safe for recording");
      await refresh();
    } catch (e) {
      setMessage(formatLoopAuthError(e, "Pause"));
    }
  }

  async function resume() {
    setMessage(null);
    try {
      await apiFetch("/api/admin/loop/resume", { method: "POST" });
      setMessage("Loop resumed");
      await refresh();
    } catch (e) {
      setMessage(formatLoopAuthError(e, "Resume"));
    }
  }

  function formatLoopAuthError(e: unknown, action: string): string {
    if (!getDemoToken()) {
      return `${action} failed — no demo token in browser. Open the app as /?t=<DEMO_TOKEN> or paste the token below.`;
    }
    if (e instanceof ApiError && e.status === 401) {
      return `${action} failed (401) — X-Demo-Token does not match API secret incidentbuddy-demo-token.`;
    }
    return e instanceof ApiError ? `${action} failed: ${e.message}` : `${action} failed`;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Admin</h1>
        <Link href="/admin/chaos" className="text-sm text-accent hover:underline">
          Chaos controls →
        </Link>
      </div>

      <section className="rounded-xl border border-slate-800 bg-ink-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Background loop
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Pause before recording your Devpost video so new incidents do not appear mid-demo.
          Requires the demo token (same as judging URL <span className="font-mono">?t=</span>).
        </p>

        <DemoTokenField className="mt-4" />

        {status && (
          <dl className="mt-4 space-y-2 font-mono text-xs text-slate-400">
            <div className="flex justify-between gap-4">
              <dt>Paused</dt>
              <dd className={status.paused ? "text-amber-300" : "text-emerald-300"}>
                {String(status.paused)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Scheduler</dt>
              <dd>{status.scheduler_running ? "running" : "stopped"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Last tick</dt>
              <dd className="text-slate-300">{status.last_tick_at || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Last scenario</dt>
              <dd className="text-slate-300">{status.last_scenario || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Judge active</dt>
              <dd>{status.judge_recently_active ? "yes" : "no"}</dd>
            </div>
          </dl>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pause}
            className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-200"
          >
            Pause loop
          </button>
          <button
            type="button"
            onClick={resume}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300"
          >
            Resume loop
          </button>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-400"
          >
            Refresh
          </button>
        </div>

        {message && <p className="mt-3 font-mono text-xs text-accent">{message}</p>}
      </section>
    </div>
  );
}
