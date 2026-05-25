export function ChaosTimeline({ events }: { events: { label: string; offset: string }[] }) {
  if (!events.length) return null;
  return (
    <div className="rounded-xl border border-slate-800 bg-ink-900/40 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chaos timeline</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {events.map((e, i) => (
          <span key={`${e.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-slate-600">·</span>}
            <span className="font-mono text-slate-500">{e.offset}</span>
            <span className="text-slate-300">{e.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
