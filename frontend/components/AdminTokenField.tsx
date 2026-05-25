"use client";

import { useState } from "react";

const ADMIN_KEY = "incidentbuddy:admin-token";
const DEFAULT_ADMIN_TOKEN = "dev-admin-change-me";

/** Read or seed admin token synchronously (before any API call / useEffect). */
export function getAdminToken(defaultValue = DEFAULT_ADMIN_TOKEN): string {
  if (typeof window === "undefined") return defaultValue;
  const stored = sessionStorage.getItem(ADMIN_KEY);
  if (stored) return stored;
  sessionStorage.setItem(ADMIN_KEY, defaultValue);
  return defaultValue;
}

/** Persists admin token for chaos panel + demo reset (separate from demo judging token). */
export function useAdminToken(defaultValue = DEFAULT_ADMIN_TOKEN) {
  const [token, setToken] = useState(() => getAdminToken(defaultValue));

  function save(value: string) {
    setToken(value);
    sessionStorage.setItem(ADMIN_KEY, value);
  }

  return { token, setToken: save };
}

export function adminHeaders(): Record<string, string> {
  return { "X-Admin-Token": getAdminToken() };
}

export function AdminTokenField({
  token,
  onChange,
  className = "",
}: {
  token: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-slate-500 ${className}`}>
      Admin token
      <input
        className="mt-1 w-full rounded border border-slate-700 bg-ink-950 px-3 py-2 font-mono text-sm text-slate-200"
        value={token}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  );
}
