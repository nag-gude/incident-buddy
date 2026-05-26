"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { publicApiUrl, setPublicApiUrl } from "@/lib/publicApiUrl";
import type { StreamConnectionStatus, StreamEvent } from "@/lib/useIncidentStream";

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
] as const;

type Listener = (event: StreamEvent) => void;

type StreamContextValue = {
  streamStatus: StreamConnectionStatus;
  lastEvent: StreamEvent | null;
  tick: number;
  subscribe: (listener: Listener) => () => void;
};

const StreamContext = createContext<StreamContextValue | null>(null);

export function IncidentStreamProvider({
  apiUrl,
  children,
}: {
  apiUrl: string;
  children: ReactNode;
}) {
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [tick, setTick] = useState(0);
  const listenersRef = useRef(new Set<Listener>());

  useEffect(() => {
    setPublicApiUrl(apiUrl);
  }, [apiUrl]);

  useEffect(() => {
    setStreamStatus("connecting");
    const es = new EventSource(publicApiUrl("/api/events"));
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
        listenersRef.current.forEach((fn) => fn(evt));
      } catch {
        /* ignore malformed frames */
      }
    };

    for (const t of EVENT_TYPES) es.addEventListener(t, handler(t) as EventListener);
    return () => es.close();
  }, [apiUrl]);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const value = useMemo(
    () => ({ streamStatus, lastEvent, tick, subscribe }),
    [streamStatus, lastEvent, tick, subscribe],
  );

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>;
}

export function useStreamContext(): StreamContextValue {
  const ctx = useContext(StreamContext);
  if (!ctx) {
    throw new Error("useStreamContext must be used within IncidentStreamProvider");
  }
  return ctx;
}
