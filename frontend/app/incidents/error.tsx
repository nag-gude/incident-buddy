"use client";

import { RouteErrorPanel } from "@/components/RouteErrorPanel";

export default function IncidentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorPanel
      title="Could not load incidents"
      message={
        error.message ||
        "The API may be restarting or the UI cannot reach the backend. If this is Cloud Run, rebuild the frontend with BACKEND_URL set to your API URL, then redeploy."
      }
      reset={reset}
    />
  );
}
