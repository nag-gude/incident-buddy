import Link from "next/link";
import { IncidentListAutoRefresh } from "@/components/IncidentListAutoRefresh";
import { IncidentListFiltered } from "@/components/IncidentListFiltered";
import { apiGet } from "@/lib/api";
import type { IncidentListItem } from "@/components/IncidentListFiltered";

export const dynamic = "force-dynamic";

function isActive(status: string) {
  return status !== "resolved" && status !== "cancelled";
}

export default async function IncidentsPage() {
  const incidents = await apiGet<IncidentListItem[]>("/api/incidents");
  const activeCount = incidents.filter((inc) => isActive(inc.status)).length;

  return (
    <div className="space-y-6">
      <IncidentListAutoRefresh />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Incidents</h1>
          {incidents.length > 0 && (
            <p className="mt-1 text-sm text-slate-400">
              {activeCount} active · {incidents.length} visible · auto-refreshes via SSE
            </p>
          )}
        </div>
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Demo
        </Link>
      </div>
      {incidents.length === 0 ? (
        <p className="text-slate-400">
          No incidents yet. Use the demo toolbar to simulate an alert.
        </p>
      ) : (
        <IncidentListFiltered incidents={incidents} />
      )}
    </div>
  );
}
