"use client";

import { useEffect, useRef, useState } from "react";
import { useStreamContext } from "@/components/IncidentStreamProvider";

export type StreamConnectionStatus = "connecting" | "live" | "reconnecting";

export type StreamEvent = {
  type: string;
  ts: string;
  data: Record<string, unknown>;
};

const GLOBAL_SSE_TYPES = new Set([
  "hello",
  "ping",
  "session.ping",
  "loop.paused",
  "loop.resumed",
  "loop.gc",
  "loop.tick",
  "loop.error",
  "demo.reset",
]);

function matchesIncidentFilter(evt: StreamEvent, incidentId: string): boolean {
  if (GLOBAL_SSE_TYPES.has(evt.type)) return true;
  const dataId = (evt.data as { incident_id?: string }).incident_id;
  if (dataId == null) return evt.type.startsWith("loop.");
  return String(dataId) === incidentId;
}

export function useIncidentStream(options?: {
  incidentId?: string;
  onEvent?: (e: StreamEvent) => void;
}) {
  const { streamStatus, lastEvent, tick, subscribe } = useStreamContext();
  const [filteredLast, setFilteredLast] = useState<StreamEvent | null>(null);
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;
  const incidentId = options?.incidentId;

  useEffect(() => {
    return subscribe((evt) => {
      if (incidentId && !matchesIncidentFilter(evt, incidentId)) return;
      setFilteredLast(evt);
      onEventRef.current?.(evt);
    });
  }, [subscribe, incidentId]);

  return {
    lastEvent: incidentId ? filteredLast : lastEvent,
    tick,
    connected: streamStatus === "live",
    streamStatus,
  };
}
