"use client";

import { useEffect } from "react";
import { authHeaders, captureTokenFromUrl } from "./demoToken";

/**
 * Tells the backend "a judge is watching" so the chaos loop spends live LLM
 * tokens instead of fixtures. Fires once on mount and again every 5 minutes
 * while the tab is open.
 */
export function useSessionPing() {
  useEffect(() => {
    captureTokenFromUrl();
    const ping = () => {
      fetch("/api/events/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        cache: "no-store",
      }).catch(() => {
        /* swallow — ping is best-effort */
      });
    };
    ping();
    const id = setInterval(ping, 5 * 60 * 1000);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
