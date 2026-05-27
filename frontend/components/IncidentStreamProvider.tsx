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
import { publicApiUrl } from "@/lib/publicApiUrl";
import type { StreamConnectionStatus, StreamEvent } from "@/lib/useIncidentStream";

const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

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

export function IncidentStreamProvider({ children }: { children: ReactNode }) {
  const [streamStatus, setStreamStatus] = useState<StreamConnectionStatus>("connecting");
  const [lastEvent, setLastEvent] = useState<StreamEvent | null>(null);
  const [tick, setTick] = useState(0);
  const listenersRef = useRef(new Set<Listener>());

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let cancelled = false;

    const clearReconnect = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      setStreamStatus((prev) => (prev === "live" ? "reconnecting" : "connecting"));
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** attempt, RECONNECT_MAX_MS);
      attempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;
      clearReconnect();
      es?.close();
      es = new EventSource(publicApiUrl("/api/events"));
      es.onopen = () => {
        attempt = 0;
        setStreamStatus("live");
      };
      es.onerror = () => {
        es?.close();
        es = null;
        scheduleReconnect();
      };

      const handler = (type: string) => (ev: MessageEvent) => {
        try {
          const parsed = JSON.parse(ev.data ?? "{}") as { ts?: string } & Record<
            string,
            unknown
          >;
          const { ts, ...rest } = parsed;
          const evt: StreamEvent = {
            type,
            ts: ts ?? new Date().toISOString(),
            data: rest,
          };
          setLastEvent(evt);
          setTick((t) => t + 1);
          listenersRef.current.forEach((fn) => fn(evt));
        } catch {
          /* ignore malformed frames */
        }
      };

      for (const t of EVENT_TYPES) es.addEventListener(t, handler(t) as EventListener);
    };

    connect();
    return () => {
      cancelled = true;
      clearReconnect();
      es?.close();
    };
  }, []);

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
