"use client";

/**
 * Demo-token plumbing for the judging URL.
 *
 *   https://incidentbuddy.app?t=<token>
 *
 * On first mount the token is captured from the URL into sessionStorage so it
 * survives client-side navigation, then attached as `X-Demo-Token` to every
 * mutating fetch.
 */

const KEY = "incidentbuddy:demo-token";

export function captureTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get("t");
  if (fromQuery) {
    sessionStorage.setItem(KEY, fromQuery.trim());
    url.searchParams.delete("t");
    window.history.replaceState({}, "", url.toString());
    return fromQuery;
  }
  return sessionStorage.getItem(KEY);
}

export function getDemoToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  return raw?.trim() || null;
}

export function setDemoToken(value: string): void {
  if (typeof window === "undefined") return;
  const trimmed = value.trim();
  if (trimmed) sessionStorage.setItem(KEY, trimmed);
  else sessionStorage.removeItem(KEY);
}

export function authHeaders(): Record<string, string> {
  const token = getDemoToken();
  return token ? { "X-Demo-Token": token } : {};
}
