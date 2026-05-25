"use client";

import { useEffect, useState } from "react";
import { useIncidentStream } from "@/lib/useIncidentStream";
import { streamStatusLabel } from "@/lib/streamStatus";
import { useSessionPing } from "@/lib/sessionPing";

/**
 * Mounted globally in the root layout: pings the backend so the chaos loop
 * knows a judge is watching, opens the SSE stream, and renders a tiny "Live"
 * indicator so it's visible during the demo that activity is real-time.
 */
export function LiveSession() {
  useSessionPing();
  const { streamStatus, lastEvent } = useIncidentStream();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!lastEvent) return;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 600);
    return () => clearTimeout(id);
  }, [lastEvent]);

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={`inline-block h-2 w-2 rounded-full transition-all ${
          streamStatus === "live"
            ? flash
              ? "bg-emerald-400 ring-2 ring-emerald-400/50"
              : "bg-emerald-500"
            : "bg-slate-500"
        }`}
        aria-hidden
      />
      <span className="text-xs text-slate-400">
        {streamStatusLabel(streamStatus, "short")}
      </span>
      {lastEvent && (
        <span className="hidden font-mono text-xs text-slate-400 sm:inline">
          {lastEvent.type}
        </span>
      )}
    </div>
  );
}
