"""Gateway call trace derived from agent transcript."""

from __future__ import annotations

import json

from app.db import get_conn, row_to_dict


def gateway_trace(incident_id: str, limit: int = 20) -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT step, payload_json, model, route, degraded, created_at
            FROM agent_transcript_events
            WHERE incident_id=? AND step IN ('llm.call', 'gateway_failover', 'analyze', 'compose_comms')
            ORDER BY id DESC
            LIMIT ?
            """,
            (incident_id, limit),
        ).fetchall()

    calls = []
    for row in reversed(rows):
        d = row_to_dict(row)
        payload = json.loads(d["payload_json"])
        calls.append(
            {
                "step": d["step"],
                "model": d.get("model"),
                "route": d.get("route"),
                "degraded": bool(d["degraded"]),
                "ts": d["created_at"],
                "payload": payload,
            }
        )
    return {"incident_id": incident_id, "calls": calls}
