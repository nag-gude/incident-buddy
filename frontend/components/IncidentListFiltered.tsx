"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type IncidentListItem = {
  id: string;
  service: string;
  severity: string;
  title: string;
  status: string;
  hypothesis: string | null;
  confidence: number | null;
  degraded_flags: string[];
  created_at: string;
};

function severityClass(s: string) {
  if (s === "P1") return "text-red-400 bg-red-950/50 border-red-800";
  if (s === "P2") return "text-amber-300 bg-amber-950/40 border-amber-800";
  return "text-slate-300 bg-slate-900 border-slate-700";
}

function statusClass(s: string) {
  if (s === "resolved" || s === "cancelled") return "text-emerald-400/90";
  if (s === "mitigating") return "text-amber-300";
  if (s === "investigating") return "text-sky-300";
  return "text-violet-300";
}

function isActive(status: string) {
  return status !== "resolved" && status !== "cancelled";
}

const SEVERITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };

type Filter = "all" | "active" | "resolved";
type Sort = "severity" | "newest";

export function IncidentListFiltered({ incidents }: { incidents: IncidentListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("severity");

  const filtered = useMemo(() => {
    let list = [...incidents];
    if (filter === "active") list = list.filter((i) => isActive(i.status));
    if (filter === "resolved") list = list.filter((i) => !isActive(i.status));
    list.sort((a, b) => {
      if (sort === "newest") return b.created_at.localeCompare(a.created_at);
      const sa = SEVERITY_ORDER[a.severity] ?? 9;
      const sb = SEVERITY_ORDER[b.severity] ?? 9;
      if (sa !== sb) return sa - sb;
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [incidents, filter, sort]);

  const activeCount = incidents.filter((i) => isActive(i.status)).length;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "resolved"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize ${
              filter === f
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            {f === "all" ? `All (${incidents.length})` : f === "active" ? `Active (${activeCount})` : "Resolved"}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded border border-slate-700 bg-ink-950 px-2 py-1 text-xs text-slate-300"
          >
            <option value="severity">Severity (P1 first)</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400">No incidents match this filter.</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((inc) => (
            <li key={inc.id}>
              <Link
                href={`/incidents/${inc.id}`}
                className="block rounded-xl border border-slate-800 bg-ink-900 p-4 hover:border-slate-600"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 font-mono text-xs ${severityClass(inc.severity)}`}
                  >
                    {inc.severity}
                  </span>
                  <span className="font-mono text-sm text-slate-400">{inc.service}</span>
                  <span className={`text-xs font-medium capitalize ${statusClass(inc.status)}`}>
                    {inc.status}
                  </span>
                  {inc.degraded_flags.length > 0 && (
                    <span className="rounded border border-amber-900/50 bg-amber-950/30 px-2 py-0.5 text-xs text-amber-200">
                      degraded
                    </span>
                  )}
                </div>
                <h2 className="mt-2 font-medium text-white">{inc.title}</h2>
                {inc.hypothesis && (
                  <p className="mt-1 line-clamp-2 text-sm text-slate-400">{inc.hypothesis}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
