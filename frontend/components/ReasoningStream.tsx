"use client";

import { useEffect, useRef, useState } from "react";
import type { TranscriptEvent } from "@/lib/types";

function providerChip(t: TranscriptEvent) {
  const provider = (t.payload?.provider as string) ?? t.model ?? "agent";
  const route = t.route ?? "—";
  return (
    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-slate-400">
      {provider} · {route}
    </span>
  );
}

export function ReasoningStream({ transcript }: { transcript: TranscriptEvent[] }) {
  const lines = transcript.filter((t) => t.step === "reasoning_line");
  const analyze = transcript.find((t) => t.step === "analyze");
  const failover = transcript.find((t) => t.step === "gateway_failover");

  const [visible, setVisible] = useState(0);
  const prevLineCountRef = useRef(0);

  useEffect(() => {
    const count = lines.length;
    const prev = prevLineCountRef.current;

    if (count === 0) {
      setVisible(0);
      prevLineCountRef.current = 0;
      return;
    }

    if (prev === 0) {
      setVisible(count);
      prevLineCountRef.current = count;
      return;
    }

    if (count <= prev) {
      setVisible(count);
      prevLineCountRef.current = count;
      return;
    }

    let i = prev;
    setVisible(i);
    const id = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= count) {
        clearInterval(id);
        prevLineCountRef.current = count;
      }
    }, 350);
    return () => clearInterval(id);
  }, [lines]);

  if (!lines.length && !analyze) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-ink-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">Reasoning</h2>
        <div className="flex flex-wrap gap-1">
          {analyze && providerChip(analyze)}
          {failover && (
            <span className="rounded bg-amber-950/60 px-1.5 py-0.5 font-mono text-xs text-amber-300">
              failover → {failover.model ?? "fallback"}
            </span>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-2 font-mono text-sm text-slate-300">
        {lines.slice(0, visible).map((t, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-accent">▸</span>
            <span>{String(t.payload?.text ?? "")}</span>
          </li>
        ))}
        {visible < lines.length && (
          <li className="animate-pulse text-slate-400">Thinking…</li>
        )}
      </ul>
    </section>
  );
}
