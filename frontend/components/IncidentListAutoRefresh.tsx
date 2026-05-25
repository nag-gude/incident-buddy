"use client";

import { useRouter } from "next/navigation";
import { useIncidentStream } from "@/lib/useIncidentStream";

/**
 * Mounted on the incidents list page: triggers `router.refresh()` whenever
 * the backend emits an event that could change the list (new incidents from
 * the chaos loop, state changes, GC archival, manual reset).
 */
export function IncidentListAutoRefresh() {
  const router = useRouter();
  useIncidentStream({
    onEvent: (e) => {
      if (
        e.type === "incident.created" ||
        e.type === "incident.state_change" ||
        e.type === "loop.gc" ||
        e.type === "demo.reset"
      ) {
        router.refresh();
      }
    },
  });
  return null;
}
