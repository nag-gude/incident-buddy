"""Background scheduler — keeps the dashboard alive between judge visits.

Three jobs run inside the FastAPI event loop:
- chaos_tick    fires a fresh demo scenario on `loop_interval_seconds`
- advance_state nudges open incidents through detect → diagnose → resolve
- gc_old        archives older incidents so the list stays demo-clean

Quota guard: `chaos_tick` only spends live LLM tokens when a judge has hit
the dashboard recently. Otherwise it falls back to scripted fixtures via
NAIVE_MODE-style template paths inside the orchestrator's existing fallbacks."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.db import get_conn
from app.services import event_bus, loop_state

log = logging.getLogger("incidentbuddy.scheduler")

PRESETS = [
    "error_rate",
    "latency",
    "saturation",
    "checkout_errors",
    "auth_timeouts",
]
_scheduler: AsyncIOScheduler | None = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _open_incident_count() -> int:
    with get_conn() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS n FROM incidents
            WHERE status NOT IN ('resolved', 'cancelled') AND archived = 0
            """
        ).fetchone()
    return int(row["n"]) if row else 0


def _log_run(job: str, *, scenario: str | None = None, incident_id: str | None = None,
             live_llm: bool = False, error: str | None = None) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO loop_runs (job, scenario, incident_id, live_llm, started_at, ended_at, error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (job, scenario, incident_id, 1 if live_llm else 0, _now(), _now(), error),
        )


# ---- chaos_tick ----

async def chaos_tick() -> None:
    """Spawn a fresh incident on a cadence so the dashboard stays alive."""
    if not settings.demo_loop_enabled or loop_state.is_paused():
        return

    scenario = loop_state.next_scenario(PRESETS)

    if _open_incident_count() >= settings.loop_max_concurrent_incidents:
        loop_state.mark_tick(scenario)
        _log_run("chaos_tick", scenario=scenario, error="skipped: max concurrent incidents")
        event_bus.publish(
            "loop.tick",
            scenario=scenario,
            incident_id=None,
            live_llm=False,
            skipped=True,
        )
        return

    # Import here to avoid circular import at module load (incident_service
    # imports agent_orchestrator imports llm_gateway imports config).
    from app.schemas import DemoScenario, SimulateAlertBody
    from app.services import incident_service

    live_llm = loop_state.judge_recently_active(settings.loop_live_llm_idle_minutes)

    try:
        result = incident_service.simulate_alert(
            SimulateAlertBody(scenario=DemoScenario(scenario)),
            live_llm=live_llm,
            source="auto_loop",
        )
        loop_state.mark_tick(scenario)
        _log_run("chaos_tick", scenario=scenario, incident_id=result.get("incident_id"),
                 live_llm=live_llm)
        event_bus.publish(
            "loop.tick",
            scenario=scenario,
            incident_id=result.get("incident_id"),
            live_llm=live_llm,
        )
    except Exception as exc:
        loop_state.mark_tick(scenario)
        log.exception("chaos_tick failed")
        _log_run("chaos_tick", scenario=scenario, error=str(exc), live_llm=live_llm)
        event_bus.publish("loop.error", job="chaos_tick", error=str(exc))


# ---- advance_state ----

_STATE_FLOW = {
    "open": "investigating",
    "investigating": "mitigating",
    "mitigating": "resolved",
}


async def advance_state() -> None:
    """Walk open incidents through their state machine on a short cadence."""
    if not settings.demo_loop_enabled or loop_state.is_paused():
        return

    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, status, updated_at FROM incidents
            WHERE status NOT IN ('resolved', 'cancelled') AND archived = 0
            ORDER BY created_at ASC
            """
        ).fetchall()

    advanced: list[tuple[str, str, str]] = []
    for row in rows:
        # Hold each state ~3 ticks so the dashboard animation reads naturally.
        last = row["updated_at"]
        try:
            last_dt = datetime.fromisoformat(last)
        except ValueError:
            continue
        age_seconds = (datetime.now(timezone.utc) - last_dt).total_seconds()
        if age_seconds < settings.loop_state_step_seconds * 3:
            continue

        next_state = _STATE_FLOW.get(row["status"])
        if not next_state:
            continue

        with get_conn() as conn:
            conn.execute(
                "UPDATE incidents SET status=?, updated_at=? WHERE id=?",
                (next_state, _now(), row["id"]),
            )
            conn.execute(
                """
                INSERT INTO incident_timeline (incident_id, actor, event_type, message, created_at)
                VALUES (?, 'system', 'state_change', ?, ?)
                """,
                (row["id"], f"{row['status']} → {next_state}", _now()),
            )
        advanced.append((row["id"], row["status"], next_state))

    if advanced:
        _log_run("advance_state", incident_id=advanced[0][0])
    for inc_id, prev, nxt in advanced:
        event_bus.publish("incident.state_change", incident_id=inc_id, prev=prev, next=nxt)


# ---- gc_old ----

async def gc_old() -> None:
    """Archive incidents beyond the cap, keeping the newest N visible."""
    if not settings.demo_loop_enabled or loop_state.is_paused():
        return

    cap = settings.loop_gc_max_incidents
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id FROM incidents
            WHERE archived = 0
            ORDER BY created_at DESC
            LIMIT -1 OFFSET ?
            """,
            (cap,),
        ).fetchall()
        ids = [r["id"] for r in rows]
        if not ids:
            return
        placeholders = ",".join("?" for _ in ids)
        conn.execute(
            f"UPDATE incidents SET archived = 1 WHERE id IN ({placeholders})",
            ids,
        )
    _log_run("gc_old", incident_id=ids[0])
    event_bus.publish("loop.gc", archived=len(ids))


# ---- lifecycle ----

def start() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(
        chaos_tick,
        IntervalTrigger(seconds=settings.loop_interval_seconds),
        id="chaos_tick",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        advance_state,
        IntervalTrigger(seconds=settings.loop_state_step_seconds),
        id="advance_state",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.add_job(
        gc_old,
        IntervalTrigger(hours=1),
        id="gc_old",
        coalesce=True,
        max_instances=1,
        replace_existing=True,
    )
    sched.start()
    _scheduler = sched
    log.info(
        "scheduler started — chaos_tick=%ss, advance_state=%ss, gc cap=%d",
        settings.loop_interval_seconds,
        settings.loop_state_step_seconds,
        settings.loop_gc_max_incidents,
    )
    return sched


def stop() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def get() -> AsyncIOScheduler | None:
    return _scheduler
