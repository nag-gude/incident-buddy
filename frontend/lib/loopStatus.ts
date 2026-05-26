/** Normalize loop status from GET /api/admin/loop/status or pause/resume POST. */
export type LoopStatus = {
  paused: boolean;
  last_tick_at?: string;
  last_tick_scenario?: string;
  last_scenario?: string;
  judge_recently_active?: boolean;
  scheduler_running?: boolean;
  subscribers?: number;
  jobs?: { id: string; next_run_time: string | null }[];
};

export function normalizeLoopStatus(data: LoopStatus): LoopStatus {
  const lastScenario = data.last_scenario ?? data.last_tick_scenario;
  return {
    ...data,
    paused: Boolean(data.paused),
    last_scenario: lastScenario,
    judge_recently_active: Boolean(data.judge_recently_active),
  };
}
