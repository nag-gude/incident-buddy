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
        "The API may be restarting. Wait a moment, then retry."
      }
      reset={reset}
    />
  );
}
