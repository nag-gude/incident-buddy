import type { ResilienceScore } from "@/lib/types";

export function ResilienceScorePanel({
  score,
  label,
  factors,
  summary,
}: {
  score: number;
  label: string;
  factors: ResilienceScore["factors"];
  summary?: { llm_outage: boolean; mcp_timeout: boolean; api_brownout: boolean };
}) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className="rounded-xl border border-slate-800 bg-ink-900/80 p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-white">
            {score}
            <span className="text-lg text-slate-400">/100</span>
          </p>
        </div>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-alert to-emerald-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {factors.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-300">
          {factors.slice(-4).map((f) => (
            <li key={f.id}>
              <span className="font-mono text-slate-400">{f.delta}</span> {f.label}
            </li>
          ))}
        </ul>
      )}
      {summary && (summary.llm_outage || summary.mcp_timeout || summary.api_brownout) && (
        <div className="mt-4 rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
          <p className="font-semibold">Resilience maintained under:</p>
          <ul className="mt-1 space-y-0.5">
            {summary.llm_outage && <li>✓ LLM outage</li>}
            {summary.mcp_timeout && <li>✓ MCP timeout</li>}
            {summary.api_brownout && <li>✓ API brownout</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
