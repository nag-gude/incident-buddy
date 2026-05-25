"use client";

import Link from "next/link";
import { RouteErrorPanel } from "@/components/RouteErrorPanel";

export default function IncidentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4">
      <Link href="/incidents" className="text-sm text-accent hover:underline">
        ← Incidents
      </Link>
      <RouteErrorPanel
        title="Incident temporarily unavailable"
        message={
          error.message ||
          "The backend may have restarted mid-demo. Retry to reload this incident."
        }
        reset={reset}
      />
    </div>
  );
}
