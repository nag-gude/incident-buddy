"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { normalizeLoopStatus, type LoopStatus } from "@/lib/loopStatus";

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatScenario(scenario: string | undefined): string {
  if (!scenario) return "—";
  return scenario.replaceAll("_", " ");
}

export function LoopStatusStrip() {
  const [status, setStatus] = useState<LoopStatus | null>(null);

  useEffect(() => {
    const load = () =>
      apiFetch<LoopStatus>("/api/admin/loop/status")
        .then((data) => setStatus(normalizeLoopStatus(data)))
        .catch(() => setStatus(null));
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  if (!status?.scheduler_running) return null;

  const chaosJob = status.jobs?.find((j) => j.id === "chaos_tick");
  const paused = status.paused;

  return (
    <div
      className={`rounded-lg border px-4 py-2 text-xs ${
        paused
          ? "border-amber-800/50 bg-amber-950/20 text-amber-100"
          : "border-slate-700 bg-slate-900/40 text-slate-300"
      }`}
    >
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>
          Demo loop:{" "}
          <strong className={paused ? "text-amber-300" : "text-emerald-300"}>
            {paused ? "paused" : "running"}
          </strong>
        </span>
        {!paused && (
          <>
            <span>Next spawn: {formatTime(chaosJob?.next_run_time)}</span>
            {status.last_scenario && (
              <span className="text-slate-500">Last: {formatScenario(status.last_scenario)}</span>
            )}
          </>
        )}
        {paused && (
          <Link href="/admin" className="text-accent hover:underline">
            Resume on Admin →
          </Link>
        )}
        {typeof status.subscribers === "number" && status.subscribers > 0 && (
          <span className="text-slate-500">{status.subscribers} live viewer(s)</span>
        )}
      </span>
    </div>
  );
}
