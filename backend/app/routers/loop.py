"""Loop control: pause/resume the background scheduler + status snapshot."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.auth import require_demo_token
from app.services import event_bus, loop_state, scheduler

router = APIRouter(prefix="/admin/loop", tags=["loop"])


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
        **loop_state.status(),
        "scheduler_running": s is not None and s.running,
        "jobs": jobs,
        "subscribers": event_bus.bus.subscriber_count,
    }


@router.post("/pause", dependencies=[Depends(require_demo_token)])
def pause():
    loop_state.set_paused(True)
    event_bus.publish("loop.paused")
    return loop_state.status()


@router.post("/resume", dependencies=[Depends(require_demo_token)])
def resume():
    loop_state.set_paused(False)
    event_bus.publish("loop.resumed")
    return loop_state.status()
