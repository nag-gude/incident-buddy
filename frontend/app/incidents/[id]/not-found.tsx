import Link from "next/link";

export default function IncidentNotFound() {
  return (
    <div className="space-y-4">
      <Link href="/incidents" className="text-sm text-accent hover:underline">
        ← Incidents
      </Link>
      <div className="rounded-xl border border-slate-800 bg-ink-900/80 p-6">
        <h1 className="text-xl font-semibold text-white">Incident not found</h1>
        <p className="mt-2 text-sm text-slate-400">
          This ID may have been removed by a demo reset, never existed, or the backend restarted
          with an empty database. Open the incidents list and pick a current row, or simulate a new
          alert from the home page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/incidents"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-ink-950"
          >
            View incidents
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
          >
            Demo home
          </Link>
        </div>
      </div>
    </div>
  );
}
