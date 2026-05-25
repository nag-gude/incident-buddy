const STATE_STYLES: Record<string, { dot: string; bar: string }> = {
  stable: { dot: "bg-emerald-400", bar: "from-emerald-600/30 to-transparent" },
  investigating: { dot: "bg-amber-400", bar: "from-amber-600/30 to-transparent" },
  primary_llm_down: { dot: "bg-red-500 animate-pulse", bar: "from-red-600/40 to-transparent" },
  fallback_active: { dot: "bg-orange-400", bar: "from-orange-600/35 to-transparent" },
  mcp_degraded: { dot: "bg-amber-500", bar: "from-amber-600/35 to-transparent" },
  template_mode: { dot: "bg-violet-400", bar: "from-violet-600/35 to-transparent" },
  recovery_successful: { dot: "bg-emerald-400", bar: "from-emerald-500/40 to-transparent" },
};

export function IncidentPulseBar({ state, label }: { state: string; label: string }) {
  const styles = STATE_STYLES[state] ?? STATE_STYLES.investigating;
  return (
    <div
      className={`rounded-lg border border-slate-800 bg-gradient-to-r ${styles.bar} px-4 py-3 transition-all duration-500`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${styles.dot}`} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Incident pulse</p>
          <p className="text-sm font-medium text-white">{label}</p>
        </div>
      </div>
    </div>
  );
}
