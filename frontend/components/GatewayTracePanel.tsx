"use client";

import type { GatewayTraceCall } from "@/lib/types";

export function GatewayTracePanel({ calls }: { calls: GatewayTraceCall[] }) {
  const llmCalls = calls.filter((c) => c.step === "llm.call" || c.step === "gateway_failover");
  if (!llmCalls.length) return null;

  return (
    <section className="rounded-xl border border-violet-900/40 bg-violet-950/20 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-violet-300">
        TrueFoundry gateway trace
      </h2>
      <ul className="mt-3 space-y-2 font-mono text-xs">
        {llmCalls.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-violet-900/30 bg-black/30 px-3 py-2">
            <span className="text-violet-400">{c.step === "gateway_failover" ? "FAILOVER" : "POST"}</span>
            <span className="text-slate-500">/chat/completions</span>
            {c.route && <span className="text-slate-400">· {c.route}</span>}
            {c.model && <span className="text-white">{c.model}</span>}
            {c.payload.latency_ms != null && (
              <span className="text-emerald-400">{String(c.payload.latency_ms)}ms</span>
            )}
            {c.payload.recovered_ms != null && (
              <span className="text-amber-300">recovered {String(c.payload.recovered_ms)}ms</span>
            )}
            {c.degraded && <span className="text-amber-500">degraded</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
