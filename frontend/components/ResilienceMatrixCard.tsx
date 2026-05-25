"use client";

import { useEffect, useState } from "react";
import type { HealthResilience } from "@/lib/types";
import { apiFetch } from "@/lib/apiClient";

const ROWS = [
  {
    flag: "llm_primary_down",
    label: "Primary LLM",
    healthy: "Gateway primary route",
    failure: "Backup model via gateway",
    failureNoGateway: "Template mode (no gateway keys)",
    recovery: "Failover strip + transcript",
  },
  {
    flag: "llm_all_down",
    label: "All LLMs",
    healthy: "Live analysis",
    failure: "Template mode",
    recovery: "Degraded banner + draft comms",
  },
  {
    flag: "mcp_metrics_down",
    label: "Metrics MCP",
    healthy: "Live metrics bundle",
    failure: "Cached evidence",
    recovery: "Evidence badge cached",
  },
  {
    flag: "mcp_all_down",
    label: "All MCP tools",
    healthy: "All tools live",
    failure: "Cache or error bundle",
    recovery: "Agent continues with partial evidence",
  },
] as const;

export function ResilienceMatrixCard({
  health,
  activeFlags,
  compact,
}: {
  health?: HealthResilience | null;
  activeFlags?: string[];
  compact?: boolean;
}) {
  const [loaded, setLoaded] = useState<HealthResilience | null>(health ?? null);

  useEffect(() => {
    if (health) {
      setLoaded(health);
      return;
    }
    apiFetch<HealthResilience>("/api/health/resilience")
      .then(setLoaded)
      .catch(() => {});
  }, [health]);

  const flags = loaded?.chaos_flags ?? {};
  const degraded = loaded?.degraded_labels ?? activeFlags ?? [];
  const gatewayConfigured = loaded?.gateway_configured ?? true;
  const allLlmsDown = !!flags.llm_all_down;
  const allMcpDown = !!flags.mcp_all_down;

  const primaryLlmDown = !!flags.llm_primary_down;
  const metricsMcpDown = !!flags.mcp_metrics_down;

  /** Layer is in a failure state (own toggle or superseded by a broader tier). */
  function isLayerDegraded(row: (typeof ROWS)[number]): boolean {
    if (row.flag === "llm_primary_down") return primaryLlmDown || allLlmsDown;
    if (row.flag === "mcp_metrics_down") return metricsMcpDown || allMcpDown;
    return !!flags[row.flag];
  }

  /** Chaos toggle for this row only (mutually exclusive tiers show off when not selected). */
  function isChaosToggleOn(row: (typeof ROWS)[number]): boolean {
    return !!flags[row.flag];
  }

  function modeForRow(row: (typeof ROWS)[number]): string {
    if (row.flag === "llm_primary_down" && allLlmsDown) {
      return "Template mode (all LLMs offline)";
    }
    if (row.flag === "llm_all_down" && primaryLlmDown && !allLlmsDown) {
      return "Tier not active — primary-only outage";
    }
    if (row.flag === "mcp_metrics_down" && allMcpDown && !metricsMcpDown) {
      return "Cache or error bundle (all MCP offline)";
    }
    if (row.flag === "mcp_all_down" && metricsMcpDown && !allMcpDown) {
      return "Tier not active — metrics-only outage";
    }
    const on = !!flags[row.flag];
    if (!on) return row.healthy;
    if (row.flag === "llm_primary_down" && !gatewayConfigured && "failureNoGateway" in row) {
      return row.failureNoGateway;
    }
    return row.failure;
  }

  function recoveryForRow(row: (typeof ROWS)[number]): string {
    if (row.flag === "llm_all_down" && primaryLlmDown && !allLlmsDown) {
      return "—";
    }
    if (row.flag === "mcp_all_down" && metricsMcpDown && !allMcpDown) {
      return "—";
    }
    if (row.flag === "llm_primary_down" && allLlmsDown) {
      return "Degraded banner + draft comms";
    }
    if (row.flag === "mcp_metrics_down" && allMcpDown) {
      return "Agent continues with partial evidence";
    }
    return row.recovery;
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-ink-900/60 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
        Resilience matrix
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        TrueFoundry challenge — failure modes and recovery paths
      </p>
      <div className={`mt-4 overflow-x-auto ${compact ? "" : ""}`}>
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="pb-2 pr-3 font-medium">Layer</th>
              <th className="pb-2 pr-3 font-medium">Chaos</th>
              <th className="pb-2 pr-3 font-medium">Current mode</th>
              <th className="pb-2 font-medium">Recovery UX</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const layerDegraded = isLayerDegraded(row);
              const chaosOn = isChaosToggleOn(row);
              return (
                <tr key={row.flag} className="border-b border-slate-900/80">
                  <td className="py-2 pr-3 font-medium text-slate-300">{row.label}</td>
                  <td className="py-2 pr-3">
                    <StatusPill chaosOn={chaosOn} layerDegraded={layerDegraded} />
                  </td>
                  <td className="py-2 pr-3 text-slate-300">{modeForRow(row)}</td>
                  <td className="py-2 text-slate-400">{recoveryForRow(row)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {degraded.length > 0 && (
        <p className="mt-3 text-xs text-amber-300">Active: {degraded.join(" · ")}</p>
      )}
      {loaded && (
        <p className="mt-2 text-xs text-slate-400">
          Gateway {loaded.gateway_configured ? "configured" : "not configured"}
          {loaded.naive_mode ? " · NAIVE_MODE (brittle)" : ""}
        </p>
      )}
    </section>
  );
}

function StatusPill({
  chaosOn,
  layerDegraded,
}: {
  chaosOn: boolean;
  layerDegraded: boolean;
}) {
  if (chaosOn) {
    return (
      <span className="inline-block rounded bg-red-950/60 px-2 py-0.5 font-mono text-xs text-red-300">
        CHAOS ON
      </span>
    );
  }
  if (layerDegraded) {
    return (
      <span
        className="inline-block rounded bg-amber-950/50 px-2 py-0.5 font-mono text-xs text-amber-300"
        title="Affected by a broader chaos tier"
      >
        affected
      </span>
    );
  }
  return (
    <span className="inline-block rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-400">
      off
    </span>
  );
}
