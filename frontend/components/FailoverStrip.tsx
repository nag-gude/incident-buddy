"use client";

import { useEffect, useState } from "react";

type FailoverPayload = {
  from_model?: string;
  to_model?: string;
  from_provider?: string;
  to_provider?: string;
  recovered_ms?: number;
};

export function FailoverStrip({
  active,
  payload,
}: {
  active: boolean;
  payload?: FailoverPayload | null;
}) {
  const [phase, setPhase] = useState<"idle" | "down" | "switching" | "ok">("idle");

  useEffect(() => {
    if (!active) {
      setPhase("idle");
      return;
    }
    setPhase("down");
    const t1 = setTimeout(() => setPhase("switching"), 300);
    const t2 = setTimeout(() => setPhase("ok"), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [active, payload?.recovered_ms]);

  if (phase === "idle") return null;

  const primary = payload?.from_model?.includes("nemotron")
    ? "Nemotron"
    : payload?.from_model ?? "Primary model";
  const backup = payload?.to_model ?? "Backup model";
  const ms = payload?.recovered_ms ?? 1200;

  return (
    <div className="overflow-hidden rounded-lg border border-orange-800/60 bg-orange-950/30 transition-all duration-300">
      {phase === "down" && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-200">
          <span className="animate-pulse font-semibold">{primary} ✗</span>
          <span className="text-slate-400">Connection lost…</span>
        </div>
      )}
      {phase === "switching" && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-orange-200">
          <span>{primary} ✗</span>
          <span className="text-slate-400">→</span>
          <span className="animate-pulse">Switching to backup…</span>
        </div>
      )}
      {phase === "ok" && (
        <div className="px-4 py-3 text-sm">
          <p className="text-emerald-300">
            <span className="font-semibold">{backup} ✓</span>
            <span className="ml-2 text-slate-400">· recovered in {(ms / 1000).toFixed(1)}s</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Recovered automatically via TrueFoundry AI Gateway — no operator intervention required.
          </p>
        </div>
      )}
    </div>
  );
}
