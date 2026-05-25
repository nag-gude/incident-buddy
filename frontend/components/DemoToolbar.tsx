"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminTokenField, useAdminToken } from "@/components/AdminTokenField";
import { ApiError, apiFetch } from "@/lib/apiClient";

export function DemoToolbar() {
  const router = useRouter();
  const { token: adminToken, setToken: setAdminToken } = useAdminToken();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function simulate(scenario: string) {
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ incident_id: string }>("/api/demo/simulate-alert", {
        method: "POST",
        json: { scenario },
      });
      setMessage(`Opened ${data.incident_id}`);
      router.push(`/incidents/${data.incident_id}`);
      router.refresh();
    } catch (e) {
      setMessage(
        e instanceof ApiError
          ? e.message
          : "Simulate failed — add ?t=<DEMO_TOKEN> to the URL when auth is enabled",
      );
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ seed_version?: string }>("/api/demo/reset", {
        method: "POST",
        json: {},
      });
      setMessage(`Reset OK · seed ${data.seed_version ?? "ok"}`);
      router.push("/incidents");
      router.refresh();
    } catch (e) {
      const detail = e instanceof ApiError ? e.message : "Reset failed";
      setMessage(
        detail.includes("admin") || detail.includes("401")
          ? `${detail} — check admin token`
          : detail,
      );
    } finally {
      setLoading(false);
    }
  }

  async function runTruefoundryReplay() {
    setLoading(true);
    setMessage(null);
    try {
      const data = await apiFetch<{ incident_id: string }>("/api/demo/truefoundry-replay", {
        method: "POST",
        json: {},
      });
      setMessage(`Replay complete → ${data.incident_id}`);
      router.push(`/incidents/${data.incident_id}`);
      router.refresh();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Replay failed — check admin token");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-dashed border-slate-700 bg-ink-900/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Demo toolbar</h2>
      <p className="mt-1 text-xs text-slate-500">
        Simulate payments-api alerts and auto-run the agent. For production judging URLs, open the app
        with <span className="font-mono text-slate-400">?t=&lt;DEMO_TOKEN&gt;</span>.
      </p>
      <div className="mt-4 max-w-md">
        <AdminTokenField token={adminToken} onChange={setAdminToken} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => simulate("error_rate")}
          className="rounded-md bg-alert px-3 py-1.5 text-sm font-medium text-ink-950 disabled:opacity-50"
        >
          Error rate (P1)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => simulate("latency")}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50"
        >
          Latency
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => simulate("saturation")}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50"
        >
          CPU saturation
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => simulate("checkout_errors")}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50"
        >
          Checkout 503 (P1)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => simulate("auth_timeouts")}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50"
        >
          Auth timeouts (P3)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={reset}
          className="rounded-md border border-red-900/60 px-3 py-1.5 text-sm text-red-300 disabled:opacity-50"
        >
          Reset demo
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={runTruefoundryReplay}
          className="rounded-md border border-violet-700 bg-violet-950/40 px-3 py-1.5 text-sm text-violet-200 disabled:opacity-50"
        >
          TrueFoundry judge demo
        </button>
      </div>
      {message && <p className="mt-3 font-mono text-xs text-accent">{message}</p>}
    </section>
  );
}
