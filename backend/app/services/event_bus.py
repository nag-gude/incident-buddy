"""In-process async pub/sub for SSE fanout.

A single bus instance lives in the FastAPI app state. Publishers push events;
subscribers (one per open SSE connection) each get their own bounded queue and
receive a copy of every event. Slow subscribers drop oldest events rather than
back-pressuring the publisher — the demo prioritises liveness over delivery."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class Event:
    type: str
    data: dict[str, Any] = field(default_factory=dict)
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def encode(self) -> dict[str, str]:
        return {"event": self.type, "data": json.dumps({"ts": self.ts, **self.data})}


class EventBus:
    def __init__(self, queue_size: int = 256) -> None:
        self._queue_size = queue_size
        self._subscribers: set[asyncio.Queue[Event]] = set()
        self._lock = asyncio.Lock()
        self._last_event: Event | None = None

    async def subscribe(self) -> asyncio.Queue[Event]:
        q: asyncio.Queue[Event] = asyncio.Queue(maxsize=self._queue_size)
        async with self._lock:
            self._subscribers.add(q)
        return q

    async def unsubscribe(self, q: asyncio.Queue[Event]) -> None:
        async with self._lock:
            self._subscribers.discard(q)

    def publish(self, type_: str, **data: Any) -> None:
        """Non-blocking publish. Safe to call from sync code inside the loop."""
        evt = Event(type=type_, data=data)
        self._last_event = evt
        for q in list(self._subscribers):
            try:
                q.put_nowait(evt)
            except asyncio.QueueFull:
                # Drop the oldest event so the newest still arrives.
                try:
                    q.get_nowait()
                    q.put_nowait(evt)
                except Exception:
                    pass

    @property
    def subscriber_count(self) -> int:
        return len(self._subscribers)


bus = EventBus()


def publish(type_: str, **data: Any) -> None:
    bus.publish(type_, **data)
