"""Unified incident / system log stream for live recovery UI."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.db import get_conn, row_to_dict
from app.services import event_bus

_STEP_LOG_MAP: dict[str, tuple[str, str, str]] = {
    "triage": ("agent", "info", "Triage started"),
    "mcp_call": ("mcp", "info", "MCP tool call"),
    "mcp_cache_hit": ("mcp", "warn", "MCP cache hit — serving cached evidence"),
    "runbook_loaded": ("agent", "info", "Runbook loaded"),
    "reasoning_line": ("agent", "info", "Reasoning"),
    "gateway_failover": ("gateway", "warn", "Gateway failover — primary LLM unavailable"),
    "analyze": ("agent", "info", "Analysis complete"),
    "llm.call": ("gateway", "info", "LLM gateway call"),
    "compose_comms": ("agent", "info", "Comms draft composed"),
    "degraded_mode": ("agent", "warn", "Degraded mode"),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def emit_log(
    message: str,
    *,
    level: str = "info",
    source: str = "system",
    incident_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> int:
    meta_json = json.dumps(meta or {})
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO incident_logs
            (incident_id, level, source, message, meta_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (incident_id, level, source, message, meta_json, _now()),
        )
        log_id = int(cur.lastrowid)

    event_bus.publish(
        "incident.log",
        id=log_id,
        incident_id=incident_id,
        level=level,
        source=source,
        message=message,
        meta=meta or {},
    )
    return log_id


def emit_from_transcript_step(
    incident_id: str,
    step: str,
    payload: dict[str, Any],
    *,
    degraded: bool = False,
) -> None:
    source, level, prefix = _STEP_LOG_MAP.get(step, ("agent", "info", step))
    if degraded and level == "info":
        level = "warn"

    if step == "reasoning_line":
        message = str(payload.get("text", prefix))
    elif step == "mcp_call":
        message = (
            f"MCP {payload.get('tool')} → {payload.get('status')} "
            f"({payload.get('source', 'live')})"
        )
    elif step == "gateway_failover":
        message = (
            f"Failover {payload.get('from_model')} → {payload.get('to_model')} "
            f"in {payload.get('recovered_ms', '?')}ms"
        )
    elif step == "llm.call":
        message = (
            f"POST /chat/completions · {payload.get('route')} · "
            f"{payload.get('model')} · {payload.get('latency_ms')}ms"
        )
    elif step == "analyze":
        message = f"Hypothesis ready (confidence {payload.get('confidence', '?')})"
    else:
        message = prefix

    emit_log(
        message,
        level=level,
        source=source,
        incident_id=incident_id,
        meta={"step": step, **payload, "degraded": degraded},
    )


def list_logs(
    incident_id: str,
    *,
    cursor: int | None = None,
    limit: int = 200,
) -> dict[str, Any]:
    limit = min(max(limit, 1), 500)
    with get_conn() as conn:
        if cursor:
            rows = conn.execute(
                """
                SELECT * FROM incident_logs
                WHERE incident_id=? AND id > ?
                ORDER BY id ASC
                LIMIT ?
                """,
                (incident_id, cursor, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT * FROM incident_logs
                WHERE incident_id=?
                ORDER BY id DESC
                LIMIT ?
                """,
                (incident_id, limit),
            ).fetchall()
            rows = list(reversed(rows))

    entries = [_row_to_entry(row_to_dict(r)) for r in rows]
    next_cursor = entries[-1]["id"] if entries else cursor
    return {"incident_id": incident_id, "logs": entries, "next_cursor": next_cursor}


def list_global_logs(limit: int = 100) -> dict[str, Any]:
    limit = min(max(limit, 1), 500)
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM incident_logs
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    entries = [_row_to_entry(row_to_dict(r)) for r in reversed(rows)]
    return {"logs": entries}


def _row_to_entry(d: dict) -> dict[str, Any]:
    return {
        "id": d["id"],
        "incident_id": d.get("incident_id"),
        "ts": d["created_at"],
        "level": d["level"],
        "source": d["source"],
        "message": d["message"],
        "meta": json.loads(d["meta_json"] or "{}"),
    }
