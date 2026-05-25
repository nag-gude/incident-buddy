import type { Evidence } from "@/lib/types";

/** Human-readable one-liner for evidence cards (judges skim these). */
export function evidenceSummary(e: Evidence): string {
  const r = e.result as Record<string, unknown> | null;
  if (!r || e.status === "error") {
    return "Tool unavailable — see runbook or cached bundle";
  }

  switch (e.tool) {
    case "metrics.get_snapshot": {
      const err = r.error_rate_pct as number | undefined;
      const slo = r.error_rate_slo_pct as number | undefined;
      const p99 = r.p99_latency_ms as number | undefined;
      const log = r.sample_log as string | undefined;
      const parts = [
        err != null && slo != null ? `Error rate ${err}% (SLO ${slo}%)` : null,
        p99 != null ? `p99 ${p99}ms` : null,
      ].filter(Boolean);
      return log ? `${parts.join(" · ")} — ${log}` : parts.join(" · ") || "Metrics snapshot";
    }
    case "deploys.list_recent": {
      const deploys = (r.deploys as { version?: string; minutes_ago?: number; changelog?: string }[]) ?? [];
      const d0 = deploys[0];
      if (!d0) return "No recent deploys";
      return `Latest ${d0.version} (${d0.minutes_ago}m ago): ${d0.changelog ?? "deploy"}`;
    }
    case "incidents.list_recent": {
      const incs = (r.incidents as { id?: string; title?: string; resolution?: string }[]) ?? [];
      const i0 = incs[0];
      if (!i0) return "No prior incidents";
      return `${i0.id}: ${i0.title} — ${i0.resolution ?? ""}`;
    }
    default:
      return e.tool;
  }
}
