"use client";

import { useRouter } from "next/navigation";
import { useIncidentStream } from "@/lib/useIncidentStream";

/**
 * Mounted on the incidents list page: refreshes the list whenever the backend
 * emits an event that could change it (new incidents, state changes, GC, reset).
 */
export function IncidentListAutoRefresh({ onRefresh }: { onRefresh?: () => void }) {
  const router = useRouter();
  useIncidentStream({
    onEvent: (e) => {
      if (
        e.type === "incident.created" ||
        e.type === "incident.state_change" ||
        e.type === "loop.gc" ||
        e.type === "demo.reset"
      ) {
        if (onRefresh) onRefresh();
        else router.refresh();
      }
    },
  });
  return null;
}
