"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminTokenField, useAdminToken } from "@/components/AdminTokenField";
import { ApiError, apiFetch } from "@/lib/apiClient";

const FLAG_LABELS: Record<string, string> = {
  mcp_metrics_down: "MCP metrics unavailable",
  mcp_all_down: "All MCP tools down",
  llm_primary_down: "Primary LLM down (use fallback)",
  llm_all_down: "All LLMs down (template mode)",
};

const DEMO_SEQUENCE = ["llm_primary_down", "mcp_metrics_down", "llm_all_down"] as const;

export default function ChaosPage() {
  const router = useRouter();
  const { token, setToken } = useAdminToken();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ flags: Record<string, boolean> }>("/api/admin/chaos");
    setFlags(data.flags || {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(key: string, enabled: boolean) {
    setFlags((prev) => ({ ...prev, [key]: enabled }));
    try {
      await apiFetch("/api/admin/chaos", {
        method: "POST",
        json: { flags: { [key]: enabled } },
      });
      setStatus(`Updated ${key}=${enabled}`);
      await load();
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Update failed");
      await load();
    }
  }

  async function resetAll() {
    try {
      const data = await apiFetch<{ seed_version?: string }>("/api/demo/reset", {
        method: "POST",
        json: {},
      });
      setStatus(`Reset OK · seed ${data.seed_version}`);
      await load();
      router.refresh();
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Reset failed");
    }
  }

  async function clearChaos() {
    const off: Record<string, boolean> = {};
    Object.keys(FLAG_LABELS).forEach((k) => {
      off[k] = false;
    });
    try {
      await apiFetch("/api/admin/chaos", {
        method: "POST",
        json: { flags: off },
      });
      setStatus("Chaos flags cleared");
      await load();
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Clear failed");
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Chaos controls</h1>
      <p className="text-sm text-slate-400">
        Simulate infrastructure failures. Call <span className="font-mono">POST /api/demo/reset</span> between
        video takes. Clearing chaos does not resume the background loop — use{" "}
        <a href="/admin" className="text-accent hover:underline">
          Admin → Resume loop
        </a>
        .
      </p>

      <AdminTokenField token={token} onChange={setToken} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={resetAll}
          className="rounded-md border border-red-800/60 px-3 py-1.5 text-sm text-red-300"
        >
          Reset demo data
        </button>
        <button
          type="button"
          onClick={clearChaos}
          className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300"
        >
          Clear all chaos
        </button>
      </div>

      <div className="rounded-lg border border-dashed border-orange-800/50 bg-orange-950/20 p-4">
        <p className="text-xs font-semibold uppercase text-orange-300">Demo sequence</p>
        <p className="mt-1 text-xs text-slate-400">
          On an open incident: enable each step, then <strong>Re-run analysis</strong> on the incident page.
        </p>
        <ol className="mt-3 space-y-2 text-sm">
          {DEMO_SEQUENCE.map((key, i) => (
            <li key={key} className="flex items-center justify-between gap-2">
              <span>
                {i + 1}. {FLAG_LABELS[key]}
              </span>
              <button
                type="button"
                onClick={() => toggle(key, true)}
                className="rounded bg-orange-900/50 px-2 py-0.5 text-xs text-orange-200"
              >
                Enable {String.fromCharCode(9312 + i)}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <ul className="space-y-3">
        {Object.keys(FLAG_LABELS).map((key) => (
          <li
            key={key}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-ink-900 px-4 py-3"
          >
            <label htmlFor={`chaos-${key}`} className="flex flex-1 cursor-pointer items-center gap-3">
              <div>
                <p className="font-mono text-sm text-white">{key}</p>
                <p className="text-xs text-slate-400">{FLAG_LABELS[key]}</p>
              </div>
              <input
                id={`chaos-${key}`}
                type="checkbox"
                checked={!!flags[key]}
                onChange={(e) => toggle(key, e.target.checked)}
                className="h-5 w-5 shrink-0 accent-orange-500"
              />
            </label>
          </li>
        ))}
      </ul>

      {status && <p className="font-mono text-xs text-accent">{status}</p>}
    </div>
  );
}
