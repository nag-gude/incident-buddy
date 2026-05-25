export type RankedAction = {
  rank: number;
  title: string;
  rationale: string;
  runbook_section: string;
  risk_level: string;
  command_optional?: string | null;
};

export type Evidence = {
  id: string;
  tool: string;
  status: string;
  source: string;
  result: unknown;
};

export type TranscriptEvent = {
  step: string;
  payload: Record<string, unknown>;
  model: string | null;
  route: string | null;
  degraded: boolean;
  created_at: string;
};

export type IncidentDetail = {
  id: string;
  service: string;
  severity: string;
  title: string;
  status: string;
  hypothesis: string | null;
  confidence: number | null;
  degraded_flags: string[];
  ranked_actions: RankedAction[];
  evidence: Evidence[];
  transcript: TranscriptEvent[];
  timeline: { event_type: string; message: string; created_at: string }[];
  comms_draft: { id: string; body: string; status: string } | null;
};

export type ResilienceState = {
  state: string;
  label: string;
  chaos_summary: {
    llm_outage: boolean;
    mcp_timeout: boolean;
    api_brownout: boolean;
  };
  chaos_timeline: { label: string; offset: string }[];
};

export type ResilienceScore = {
  score: number;
  label: string;
  factors: { id: string; label: string; delta: string }[];
};

export type LogEntry = {
  id: number;
  incident_id: string | null;
  ts: string;
  level: string;
  source: string;
  message: string;
  meta: Record<string, unknown>;
};

export type GatewayTraceCall = {
  step: string;
  model: string | null;
  route: string | null;
  degraded: boolean;
  ts: string;
  payload: Record<string, unknown>;
};

export type HealthResilience = {
  chaos_flags: Record<string, boolean>;
  degraded_labels: string[];
  gateway_configured: boolean;
  naive_mode: boolean;
  llm_primary_down: boolean;
  mcp_metrics_down: boolean;
};
