"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { HealthResilience } from "@/lib/types";

export function ResilienceStatusStrip() {
  const [health, setHealth] = useState<HealthResilience | null>(null);

  useEffect(() => {
    apiFetch<HealthResilience>("/api/health/resilience")
      .then(setHealth)
      .catch(() => setHealth(null));
    const id = setInterval(() => {
      apiFetch<HealthResilience>("/api/health/resilience")
        .then(setHealth)
        .catch(() => {});
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  if (!health) return null;

  const chaosActive = Object.values(health.chaos_flags).some(Boolean);
  const gatewayOk = health.gateway_configured;

  return (
    <div
      className={`rounded-lg border px-4 py-2 text-xs ${
        health.naive_mode
          ? "border-red-800/60 bg-red-950/30 text-red-200"
          : chaosActive
            ? "border-amber-800/60 bg-amber-950/30 text-amber-100"
            : gatewayOk
              ? "border-emerald-800/50 bg-emerald-950/20 text-emerald-100"
              : "border-slate-700 bg-slate-900/50 text-slate-400"
      }`}
    >
      {health.naive_mode ? (
        <span>
          <strong>Brittle mode (NAIVE_MODE)</strong> — LLM errors abort the agent. Compare with resilient
          mode for your demo video.
        </span>
      ) : (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <span>Gateway: {gatewayOk ? "ready" : "template-only"}</span>
          <span>Chaos: {chaosActive ? "injected" : "off"}</span>
          {health.degraded_labels.length > 0 && (
            <span>Degraded: {health.degraded_labels.join(", ")}</span>
          )}
        </span>
      )}
    </div>
  );
}
