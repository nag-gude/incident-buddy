"use client";

import { useEffect, useRef, useState } from "react";

export type StreamConnectionStatus = "connecting" | "live" | "reconnecting";

export type StreamEvent = {
  type: string;
  ts: string;
  data: Record<string, unknown>;
};

const EVENT_TYPES = [
  "hello",
  "ping",
  "loop.tick",
  "loop.paused",
  "loop.resumed",
  "loop.gc",
  "loop.error",
  "incident.created",
  "incident.state_change",
  "incident.log",
  "agent.transcript",
  "agent.complete",
  "comms.approved",
  "comms.rejected",
  "session.ping",
  "demo.reset",
];

export function useIncidentStream(options?: {
  incidentId?: string;
  onEvent?: (e: StreamEvent) => void;
}) {
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [tick, setTick] = useState(0);
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>("connecting");
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;
  const incidentId = options?.incidentId;

  useEffect(() => {
    setStreamStatus("connecting");
    const url = incidentId
      ? `/api/events?incident_id=${encodeURIComponent(incidentId)}`
      : "/api/events";
    const es = new EventSource(url);
    es.onopen = () => setStreamStatus("live");
    es.onerror = () =>
      setStreamStatus((prev) => (prev === "live" ? "reconnecting" : prev));

    const handler = (type: string) => (ev: MessageEvent) => {
      try {
        const parsed = JSON.parse(ev.data ?? "{}") as { ts?: string } & Record<string, unknown>;
        const { ts, ...rest } = parsed;
        const evt: StreamEvent = { type, ts: ts ?? new Date().toISOString(), data: rest };
        setLastEvent(evt);
        setTick((t) => t + 1);
        onEventRef.current?.(evt);
      } catch {
        /* ignore malformed frames */
      }
    };

    for (const t of EVENT_TYPES) es.addEventListener(t, handler(t) as EventListener);

    return () => es.close();
  }, [incidentId]);

  return { lastEvent, tick, connected: streamStatus === "live", streamStatus };
}
