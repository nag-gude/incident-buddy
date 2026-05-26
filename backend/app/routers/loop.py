"""Loop control: pause/resume the background scheduler + status snapshot."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import require_loop_control_token
from app.config import settings
from app.services import event_bus, loop_state, scheduler

router = APIRouter(prefix="/admin/loop", tags=["loop"])


def _status_payload() -> dict:
    """Unified loop status for admin UI, SSE hello, and pause/resume responses."""
    base = loop_state.status()
    last_scenario = base.get("last_tick_scenario")
    return {
        **base,
        "last_scenario": last_scenario,
        "judge_recently_active": loop_state.judge_recently_active(settings.loop_live_llm_idle_minutes),
    }


@router.get("/status")
def get_status():
    s = scheduler.get()
    jobs = []
    if s is not None:
        for job in s.get_jobs():
            jobs.append({
                "id": job.id,
                "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            })
    return {
        **_status_payload(),
        "scheduler_running": s is not None and s.running,
        "jobs": jobs,
        "subscribers": event_bus.bus.subscriber_count,
    }


@router.post("/pause", dependencies=[Depends(require_loop_control_token)])
def pause():
    loop_state.set_paused(True)
    payload = _status_payload()
    event_bus.publish("loop.paused", **payload)
    return payload


@router.post("/resume", dependencies=[Depends(require_loop_control_token)])
def resume():
    loop_state.set_paused(False)
    payload = _status_payload()
    event_bus.publish("loop.resumed", **payload)
    return payload
