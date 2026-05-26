"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useStreamContext } from "@/components/IncidentStreamProvider";
import { DemoTokenField } from "@/components/DemoTokenField";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { getDemoToken } from "@/lib/demoToken";
import { normalizeLoopStatus, type LoopStatus } from "@/lib/loopStatus";

async function postLoop(path: "/api/admin/loop/pause" | "/api/admin/loop/resume"): Promise<LoopStatus> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await apiFetch<LoopStatus>(path, { method: "POST" });
    } catch (e) {
      lastErr = e;
      if (e instanceof ApiError && e.status === 429 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

export default function AdminPage() {
  const { subscribe } = useStreamContext();
  const [status, setStatus] = useState<LoopStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pause" | "resume" | null>(null);

  const applyStatus = useCallback((raw: LoopStatus, extra?: Partial<LoopStatus>) => {
    setStatus(normalizeLoopStatus({ ...raw, ...extra }));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<LoopStatus>("/api/admin/loop/status");
      applyStatus(data);
    } catch {
      setStatus(null);
    }
  }, [applyStatus]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 15_000);
    const unsub = subscribe((evt) => {
      if (evt.type === "loop.paused" || evt.type === "loop.resumed") refresh();
    });
    return () => {
      clearInterval(poll);
      unsub();
    };
  }, [refresh, subscribe]);

  async function pause() {
    setMessage(null);
    setBusy("pause");
    try {
      const data = await postLoop("/api/admin/loop/pause");
      applyStatus(data);
      setMessage(data.paused ? "Loop paused — safe for recording" : "Pause did not stick — see note below");
    } catch (e) {
      setMessage(formatLoopAuthError(e, "Pause"));
    } finally {
      setBusy(null);
    }
  }

  async function resume() {
    setMessage(null);
    setBusy("resume");
    try {
      const data = await postLoop("/api/admin/loop/resume");
      applyStatus(data);
      setMessage(data.paused ? "Resume did not stick — see note below" : "Loop resumed");
    } catch (e) {
      setMessage(formatLoopAuthError(e, "Resume"));
    } finally {
      setBusy(null);
    }
  }

  function formatLoopAuthError(e: unknown, action: string): string {
    if (!getDemoToken()) {
      return `${action} failed — no demo token in browser. Open the app as /?t=<DEMO_TOKEN> or paste the token below.`;
    }
    if (e instanceof ApiError && e.status === 401) {
      return `${action} failed (401) — token must match API demo or admin secret.`;
    }
    if (e instanceof ApiError && e.status === 429) {
      return `${action} failed (429) — API busy. Wait a few seconds and retry, or pause via curl against the API URL directly.`;
    }
    return e instanceof ApiError ? `${action} failed: ${e.message}` : `${action} failed`;
  }

  const paused = status?.paused ?? false;

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
          Requires the demo token (same as judging URL <span className="font-mono">?t=</span>) or
          admin token from Chaos controls.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Clearing chaos flags does <strong className="text-slate-300">not</strong> resume the loop —
          only the Resume button does.
        </p>

        <DemoTokenField className="mt-4" />

        {status && (
          <dl className="mt-4 space-y-2 font-mono text-xs text-slate-400">
            <div className="flex justify-between gap-4">
              <dt>Paused</dt>
              <dd className={paused ? "text-amber-300" : "text-emerald-300"}>
                {String(paused)}
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
            disabled={busy !== null || paused}
            onClick={pause}
            className="rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-1.5 text-sm text-amber-200 disabled:opacity-40"
          >
            {busy === "pause" ? "Pausing…" : "Pause loop"}
          </button>
          <button
            type="button"
            disabled={busy !== null || !paused}
            onClick={resume}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
          >
            {busy === "resume" ? "Resuming…" : "Resume loop"}
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

        {message?.includes("did not stick") && (
          <p className="mt-2 text-xs text-amber-200/90">
            On Cloud Run with multiple API instances, pause state is per-instance (SQLite in /tmp).
            Set <span className="font-mono">backend_max_instance_count = 1</span> in Terraform and
            redeploy the API service.
          </p>
        )}
      </section>
    </div>
  );
}
