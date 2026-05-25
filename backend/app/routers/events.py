"""Server-Sent Events: live push of incident + loop events to the dashboard."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.config import settings
from app.services import event_bus, loop_state

router = APIRouter(tags=["events"])


def _matches_filter(evt: event_bus.Event, incident_id: str | None) -> bool:
    if not incident_id:
        return True
    if evt.type in ("hello", "ping", "session.ping", "loop.paused", "loop.resumed", "loop.gc", "loop.tick", "loop.error", "demo.reset"):
        return True
    data_iid = evt.data.get("incident_id")
    if data_iid is None:
        return evt.type.startswith("loop.")
    return str(data_iid) == incident_id


@router.get("/events")
async def events(
    request: Request,
    incident_id: str | None = Query(None, description="Filter to one incident + global events"),
):
    """Open SSE stream. Frontend uses EventSource('/api/events')."""
    queue = await event_bus.bus.subscribe()

    async def stream():
        try:
            yield event_bus.Event(
                type="hello",
                data={
                    "loop": loop_state.status(),
                    "subscriber_count": event_bus.bus.subscriber_count,
                    "filter_incident_id": incident_id,
                },
            ).encode()

            while True:
                if await request.is_disconnected():
                    break
                try:
                    evt = await asyncio.wait_for(
                        queue.get(),
                        timeout=settings.sse_keepalive_seconds,
                    )
                    if _matches_filter(evt, incident_id):
                        yield evt.encode()
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
        finally:
            await event_bus.bus.unsubscribe(queue)

    return EventSourceResponse(stream())


@router.post("/events/ping")
async def ping():
    """Frontend posts here on page load + at intervals — signals a judge is watching."""
    ts = loop_state.ping_session()
    event_bus.publish("session.ping", ts=ts)
    return {"status": "ok", "ts": ts}
