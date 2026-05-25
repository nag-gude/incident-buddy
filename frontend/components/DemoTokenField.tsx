"use client";

import { useState } from "react";
import { getDemoToken, setDemoToken } from "@/lib/demoToken";

/** Lets operators paste the demo token when they did not land with ?t= in the URL. */
export function DemoTokenField({ className = "" }: { className?: string }) {
  const [token, setToken] = useState(() => getDemoToken() ?? "");
  const stored = getDemoToken();

  function save() {
    setDemoToken(token);
    setToken(getDemoToken() ?? "");
  }

  return (
    <div className={`rounded-lg border border-slate-800 bg-ink-950/50 p-3 ${className}`}>
      <label className="block text-xs text-slate-500">
        Demo token (must match Secret Manager <span className="font-mono">incidentbuddy-demo-token</span>)
        <input
          type="password"
          className="mt-1 w-full rounded border border-slate-700 bg-ink-950 px-3 py-2 font-mono text-sm text-slate-200"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Same value as ?t= in judging URL"
          autoComplete="off"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300"
        >
          Save to session
        </button>
        {stored ? (
          <span className="text-xs text-emerald-400">Token stored — mutating API calls enabled</span>
        ) : (
          <span className="text-xs text-amber-400">
            Missing — open app as <span className="font-mono">/?t=&lt;token&gt;</span> or paste above
          </span>
        )}
      </div>
    </div>
  );
}
