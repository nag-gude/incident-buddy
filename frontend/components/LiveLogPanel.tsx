"use client";

import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/lib/types";

const LEVEL_CLASS: Record<string, string> = {
  error: "text-red-300",
  warn: "text-amber-300",
  info: "text-slate-300",
  debug: "text-slate-500",
};

const SOURCE_CLASS: Record<string, string> = {
  gateway: "bg-violet-950/60 text-violet-300",
  mcp: "bg-cyan-950/60 text-cyan-300",
  agent: "bg-slate-800 text-slate-400",
  system: "bg-slate-800 text-slate-500",
};

export function LiveLogPanel({ logs }: { logs: LogEntry[] }) {
  const [paused, setPaused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, paused]);

  return (
    <section className="rounded-xl border border-slate-800 bg-black/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Live recovery log</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">{logs.length} lines</span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="rounded border border-slate-700 px-2 py-0.5 text-slate-400 hover:text-white"
          >
            {paused ? "Resume scroll" : "Pause scroll"}
          </button>
        </div>
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-slate-600">Waiting for agent activity…</p>
        ) : (
          <ul className="space-y-1">
            {logs.map((line) => (
              <li
                key={line.id}
                className="flex flex-wrap items-start gap-2 border-b border-slate-900/80 py-1"
              >
                <span className="shrink-0 text-slate-600">{line.ts.slice(11, 19)}</span>
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[10px] uppercase ${SOURCE_CLASS[line.source] ?? SOURCE_CLASS.system}`}
                >
                  {line.source}
                </span>
                <span className={LEVEL_CLASS[line.level] ?? LEVEL_CLASS.info}>{line.message}</span>
              </li>
            ))}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}
