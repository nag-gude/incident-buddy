"use client";

import { useState } from "react";
import type { Evidence } from "@/lib/types";
import { evidenceSummary } from "@/lib/evidenceFormat";

function sourceBadge(source: string) {
  if (source === "cached") return "rounded bg-amber-900/40 px-1.5 text-amber-200";
  if (source === "unavailable") return "rounded bg-red-900/40 px-1.5 text-red-200";
  return "rounded bg-emerald-900/40 px-1.5 text-emerald-200";
}

export function EvidenceCard({ e }: { e: Evidence }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="rounded-lg border border-slate-800 bg-ink-950 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="font-mono text-white">[{e.id}]</span>
            <span className="text-slate-400">{e.tool}</span>
            <span className={sourceBadge(e.source)}>{e.source}</span>
          </div>
          <p className="mt-2 text-sm leading-snug text-slate-300">{evidenceSummary(e)}</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((x) => !x)}
          className="shrink-0 text-xs text-slate-500 hover:text-slate-300"
        >
          {expanded ? "Hide JSON" : "Raw JSON"}
        </button>
      </div>
      {expanded && (
        <pre className="mt-2 max-h-40 overflow-auto text-xs text-slate-500">
          {JSON.stringify(e.result, null, 2)}
        </pre>
      )}
    </li>
  );
}
