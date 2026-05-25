"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChaosTimeline } from "@/components/ChaosTimeline";
import { CommsPanel } from "@/components/CommsPanel";
import { DegradedBanner } from "@/components/DegradedBanner";
import { EvidenceCard } from "@/components/EvidenceCard";
import { FailoverStrip } from "@/components/FailoverStrip";
import { GatewayTracePanel } from "@/components/GatewayTracePanel";
import { IncidentPulseBar } from "@/components/IncidentPulseBar";
import { LiveLogPanel } from "@/components/LiveLogPanel";
import { ReasoningStream } from "@/components/ReasoningStream";
import { ResilienceMatrixCard } from "@/components/ResilienceMatrixCard";
import { ResilienceScorePanel } from "@/components/ResilienceScorePanel";
import { ApiError, apiFetch } from "@/lib/apiClient";
import { streamStatusLabel } from "@/lib/streamStatus";
import type {
  GatewayTraceCall,
  IncidentDetail,
  LogEntry,
  ResilienceScore,
  ResilienceState,
} from "@/lib/types";
import { useIncidentStream } from "@/lib/useIncidentStream";

function severityBadgeClass(s: string) {
  if (s === "P1") return "text-red-400 bg-red-950/50 border-red-800";
  if (s === "P2") return "text-amber-300 bg-amber-950/40 border-amber-800";
  return "text-slate-300 bg-slate-900 border-slate-700";
}

export function IncidentLiveDashboard({ initial }: { initial: IncidentDetail }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [resState, setResState] = useState<ResilienceState | null>(null);
  const [resScore, setResScore] = useState<ResilienceScore | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [gatewayTrace, setGatewayTrace] = useState<GatewayTraceCall[]>([]);
  const [running, setRunning] = useState(false);
  const [failoverKey, setFailoverKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const latestFailover = useMemo(() => {
    const ev = [...data.transcript].reverse().find((t) => t.step === "gateway_failover");
    return ev?.payload;
  }, [data.transcript]);

  const showFailover = useMemo(
    () =>
      data.transcript.some(
        (t) =>
          t.step === "gateway_failover" ||
          (t.step === "analyze" &&
            (t.route === "fallback" || t.route === "fallback-after-error")),
      ),
    [data.transcript],
  );

  const loadLogs = useCallback(async () => {
    try {
      const res = await apiFetch<{ logs: LogEntry[] }>(`/api/incidents/${initial.id}/logs`);
      setLogs(res.logs);
    } catch {
      /* ignore */
    }
  }, [initial.id]);

  const loadGatewayTrace = useCallback(async () => {
    try {
      const res = await apiFetch<{ calls: GatewayTraceCall[] }>(
        `/api/incidents/${initial.id}/gateway-trace`,
      );
      setGatewayTrace(res.calls);
    } catch {
      /* ignore */
    }
  }, [initial.id]);

  const refreshScore = useCallback(async () => {
    try {
      const [state, score] = await Promise.all([
        apiFetch<ResilienceState>(`/api/incidents/${initial.id}/resilience-state`),
        apiFetch<ResilienceScore>(`/api/incidents/${initial.id}/resilience-score`),
      ]);
      setResState(state);
      setResScore(score);
    } catch {
      /* ignore */
    }
  }, [initial.id]);

  const refreshIncident = useCallback(async () => {
    try {
      const inc = await apiFetch<IncidentDetail>(`/api/incidents/${initial.id}`);
      setData(inc);
      setError(null);
      if (inc.transcript.some((t) => t.step === "gateway_failover")) {
        setFailoverKey((k) => k + 1);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to refresh incident");
    }
  }, [initial.id]);

  const fullRefresh = useCallback(async () => {
    await Promise.all([refreshIncident(), refreshScore(), loadLogs(), loadGatewayTrace()]);
  }, [refreshIncident, refreshScore, loadLogs, loadGatewayTrace]);

  const appendLogFromEvent = useCallback((e: { data: Record<string, unknown> }) => {
    const d = e.data;
    const id = d.id as number | undefined;
    if (id == null || !d.message) return;
    setLogs((prev) => {
      if (prev.some((l) => l.id === id)) return prev;
      return [
        ...prev,
        {
          id,
          incident_id: (d.incident_id as string) ?? initial.id,
          ts: (d.ts as string) ?? new Date().toISOString(),
          level: (d.level as string) ?? "info",
          source: (d.source as string) ?? "system",
          message: String(d.message),
          meta: (d.meta as Record<string, unknown>) ?? {},
        },
      ];
    });
  }, [initial.id]);

  const { streamStatus } = useIncidentStream({
    incidentId: initial.id,
    onEvent: (e) => {
      if (e.type === "incident.log") {
        appendLogFromEvent(e);
        return;
      }
      const incidentId = (e.data as { incident_id?: string }).incident_id;
      if (e.type === "agent.complete" || (incidentId && incidentId === initial.id)) {
        if (e.type === "agent.transcript") return;
        fullRefresh();
      }
    },
  });

  useEffect(() => {
    fullRefresh();
    const id = setInterval(refreshScore, 30_000);
    return () => clearInterval(id);
  }, [fullRefresh, refreshScore]);

  async function rerunAgent() {
    setRunning(true);
    setError(null);
    try {
      await apiFetch(`/api/incidents/${data.id}/run-agent`, { method: "POST" });
      await fullRefresh();
      router.refresh();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Re-run failed — set ?t=<DEMO_TOKEN> if auth is enabled",
      );
    } finally {
      setRunning(false);
    }
  }

  const pulse = resState ?? { state: "investigating", label: "Investigating" };

  const telemetryColumn = (
    <div className="space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Resilience telemetry
      </p>
      {resScore && (
        <ResilienceScorePanel
          score={resScore.score}
          label={resScore.label}
          factors={resScore.factors}
          summary={resState?.chaos_summary}
        />
      )}
      <ResilienceMatrixCard activeFlags={data.degraded_flags} compact />
      <FailoverStrip key={failoverKey} active={showFailover} payload={latestFailover} />
      <GatewayTracePanel calls={gatewayTrace} />
      <LiveLogPanel logs={logs} />
      {resState?.chaos_timeline && resState.chaos_timeline.length > 0 && (
        <ChaosTimeline events={resState.chaos_timeline} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/incidents" className="text-sm text-accent hover:underline">
          ← Incidents
        </Link>
        <span className="text-xs text-slate-400">
          {streamStatusLabel(streamStatus, "detail")}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <IncidentPulseBar state={pulse.state} label={pulse.label} />

      <header className="rounded-2xl border border-slate-800 bg-ink-900 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 font-mono text-xs ${severityBadgeClass(data.severity)}`}
          >
            {data.severity}
          </span>
          <span className="font-mono text-sm text-slate-400">{data.service}</span>
          <span className="text-xs capitalize text-slate-400">{data.status}</span>
        </div>
        <p className="mt-2 font-mono text-xs text-slate-400">{data.id}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{data.title}</h1>
      </header>

      <DegradedBanner flags={data.degraded_flags} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running}
          onClick={rerunAgent}
          className="rounded-lg bg-alert px-4 py-2 text-sm font-semibold text-ink-950 disabled:opacity-50"
        >
          {running ? "Running agent…" : "Re-run analysis"}
        </button>
        <Link
          href="/admin/chaos"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:border-slate-500"
        >
          Chaos controls
        </Link>
      </div>

      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Incident response
          </p>
          <ReasoningStream transcript={data.transcript} />

          {data.hypothesis && (
            <section className="rounded-xl border border-slate-800 bg-ink-900/80 p-5">
              <h2 className="text-xs font-semibold uppercase text-slate-400">Hypothesis</h2>
              <p className="mt-2 text-slate-200">{data.hypothesis}</p>
              {data.confidence != null && (
                <p className="mt-2 text-xs text-slate-400">
                  Confidence: {(data.confidence * 100).toFixed(0)}%
                </p>
              )}
            </section>
          )}

          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-1">
            <section className="rounded-xl border border-slate-800 bg-ink-900/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
                Ranked actions
              </h2>
              <ol className="mt-3 list-decimal space-y-4 pl-5 text-sm">
                {data.ranked_actions.map((a) => (
                  <li key={a.rank} className="text-slate-300">
                    <p className="font-medium text-white">{a.title}</p>
                    <p className="mt-1 text-slate-400">{a.rationale}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      Runbook §{a.runbook_section} · risk {a.risk_level}
                    </p>
                    {a.command_optional && (
                      <pre className="mt-2 overflow-x-auto rounded bg-black/50 p-2 text-xs text-emerald-400/90">
                        {a.command_optional}
                      </pre>
                    )}
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-slate-800 bg-ink-900/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
                Evidence
              </h2>
              <ul className="mt-3 space-y-3">
                {data.evidence.map((e) => (
                  <EvidenceCard key={e.id} e={e} />
                ))}
              </ul>
            </section>
          </div>

          <section className="rounded-xl border border-slate-800 bg-ink-900/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">
              Draft comms
            </h2>
            <div className="mt-3">
              <CommsPanel incidentId={data.id} draft={data.comms_draft} onUpdated={fullRefresh} />
            </div>
          </section>
        </div>

        {telemetryColumn}
      </div>

      <p className="text-center text-xs text-slate-400">
        TrueFoundry AI Gateway · graceful degradation · MCP resilient agents
      </p>
    </div>
  );
}
