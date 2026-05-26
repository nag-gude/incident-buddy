"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IncidentListAutoRefresh } from "@/components/IncidentListAutoRefresh";
import { IncidentListFiltered, type IncidentListItem } from "@/components/IncidentListFiltered";
import { ApiError, apiFetch } from "@/lib/apiClient";

function isActive(status: string) {
  return status !== "resolved" && status !== "cancelled";
}

export function IncidentListPage() {
  const [incidents, setIncidents] = useState<IncidentListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch<IncidentListItem[]>("/api/incidents");
      setIncidents(data);
    } catch (e) {
      setIncidents(null);
      setError(
        e instanceof ApiError
          ? e.message
          : "Could not reach the API. Check that the backend is running and /api is proxied correctly.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = incidents?.filter((inc) => isActive(inc.status)).length ?? 0;

  return (
    <div className="space-y-6">
      <IncidentListAutoRefresh onRefresh={load} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          {incidents && incidents.length > 0 && (
            <p className="mt-1 text-sm text-slate-400">
              {activeCount} active · {incidents.length} visible · auto-refreshes via SSE
            </p>
          )}
        </div>
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Demo
        </Link>
      </div>

      {loading && <p className="animate-pulse text-sm text-slate-400">Loading incidents…</p>}

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              load();
            }}
            className="mt-2 rounded-md border border-red-800 px-3 py-1 text-xs text-red-100 hover:bg-red-900/40"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && incidents && incidents.length === 0 && (
        <p className="text-slate-400">
          No incidents yet. Use the demo toolbar to simulate an alert.
        </p>
      )}

      {!loading && !error && incidents && incidents.length > 0 && (
        <IncidentListFiltered incidents={incidents} />
      )}
    </div>
  );
}
