"""Incident CRUD, alerts, comms approval."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.config import settings
from app.db import get_conn, json_loads, row_to_dict
from app.schemas import (
    AlertWebhookBody,
    ApproveCommsBody,
    IncidentDetail,
    IncidentSummary,
    RankedAction,
    RejectCommsBody,
    SimulateAlertBody,
)
from app.services import agent_orchestrator, chaos, event_bus, log_service, loop_state, mcp_adapter


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


SCENARIOS = {
    "error_rate": {
        "service": "payments-api",
        "severity": "P1",
        "title": "Error rate 12.4% (SLO 1%)",
        "description": "5xx rate exceeded threshold for 5 minutes.",
        "runbook_id": "payments-error-rate",
    },
    "latency": {
        "service": "payments-api",
        "severity": "P2",
        "title": "p99 latency 890ms (SLO 500ms)",
        "description": "Latency SLO breach on checkout path.",
        "runbook_id": "payments-error-rate",
    },
    "saturation": {
        "service": "payments-api",
        "severity": "P2",
        "title": "CPU saturation 78%",
        "description": "Pod CPU high on payments-api deployment.",
        "runbook_id": "payments-error-rate",
    },
    "checkout_errors": {
        "service": "checkout-api",
        "severity": "P1",
        "title": "Checkout 503 spike — cart abandon risk",
        "description": "Elevated 503 responses on /v1/cart/checkout.",
        "runbook_id": "payments-error-rate",
    },
    "auth_timeouts": {
        "service": "auth-service",
        "severity": "P3",
        "title": "Token validation timeouts elevated",
        "description": "Intermittent auth latency; no customer-facing outage yet.",
        "runbook_id": "payments-error-rate",
    },
}


def create_from_alert(body: AlertWebhookBody, *, source: str | None = None) -> dict:
    if body.dedupe_key:
        with get_conn() as conn:
            row = conn.execute(
                """
                SELECT id FROM incidents
                WHERE dedupe_key=? AND status NOT IN ('resolved', 'cancelled') AND archived = 0
                ORDER BY created_at DESC LIMIT 1
                """,
                (body.dedupe_key,),
            ).fetchone()
        if row:
            return {"incident_id": row["id"], "deduped": True}

    incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
    runbook_id = body.runbook_id or "payments-error-rate"
    now = _now()

    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO incidents
            (id, service, severity, title, description, status, runbook_id, dedupe_key,
             hypothesis, confidence, evidence_refs, ranked_actions, degraded_flags,
             created_at, updated_at, archived, source)
            VALUES (?, ?, ?, ?, ?, 'open', ?, ?, NULL, NULL, '[]', '[]', '[]', ?, ?, 0, ?)
            """,
            (
                incident_id,
                body.service,
                body.severity,
                body.title,
                body.description,
                runbook_id,
                body.dedupe_key,
                now,
                now,
                source,
            ),
        )
        conn.execute(
            """
            INSERT INTO incident_timeline (incident_id, actor, event_type, message, created_at)
            VALUES (?, 'system', 'alert_received', ?, ?)
            """,
            (incident_id, body.title, now),
        )

    event_bus.publish(
        "incident.created",
        incident_id=incident_id,
        service=body.service,
        severity=body.severity,
        title=body.title,
        source=source,
    )
    log_service.emit_log(
        f"Incident created: {incident_id} · {body.severity} · {body.title}",
        source="system",
        incident_id=incident_id,
        meta={"severity": body.severity, "service": body.service},
    )
    return {"incident_id": incident_id, "deduped": False}


def simulate_alert(
    body: SimulateAlertBody,
    *,
    live_llm: bool = True,
    source: str | None = None,
) -> dict:
    scenario_key = body.scenario.value
    scenario = SCENARIOS[scenario_key]
    alert = AlertWebhookBody(**scenario)
    mcp_adapter.seed_demo_cache(scenario["service"])
    result = create_from_alert(alert, source=source)
    agent_orchestrator.run_agent(
        result["incident_id"],
        scenario["service"],
        scenario["runbook_id"],
        live_llm=live_llm,
        scenario=scenario_key,
    )
    return result


def list_incidents() -> list[IncidentSummary]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM incidents
            WHERE archived = 0
            ORDER BY
              CASE status
                WHEN 'open' THEN 1
                WHEN 'investigating' THEN 2
                WHEN 'mitigating' THEN 3
                ELSE 4
              END,
              created_at DESC
            """
        ).fetchall()
    out: list[IncidentSummary] = []
    for row in rows:
        d = row_to_dict(row)
        out.append(
            IncidentSummary(
                id=d["id"],
                service=d["service"],
                severity=d["severity"],
                title=d["title"],
                status=d["status"],
                hypothesis=d.get("hypothesis"),
                confidence=d.get("confidence"),
                degraded_flags=chaos.normalize_degraded_flags(json_loads(d.get("degraded_flags"), [])),
                created_at=d["created_at"],
                updated_at=d["updated_at"],
            )
        )
    return out


def get_incident(incident_id: str) -> IncidentDetail:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Incident not found")
        d = row_to_dict(row)

        timeline = [
            row_to_dict(r)
            for r in conn.execute(
                "SELECT * FROM incident_timeline WHERE incident_id=? ORDER BY id",
                (incident_id,),
            ).fetchall()
        ]
        evidence = [
            {
                "id": r["id"],
                "tool": r["tool"],
                "status": r["status"],
                "source": r["source"],
                "result": json.loads(r["result_json"]),
                "fetched_at": r["fetched_at"],
            }
            for r in conn.execute(
                "SELECT * FROM evidence_bundles WHERE incident_id=? ORDER BY fetched_at",
                (incident_id,),
            ).fetchall()
        ]
        transcript = [
            {
                "step": r["step"],
                "payload": json.loads(r["payload_json"]),
                "model": r["model"],
                "route": r["route"],
                "degraded": bool(r["degraded"]),
                "created_at": r["created_at"],
            }
            for r in conn.execute(
                "SELECT * FROM agent_transcript_events WHERE incident_id=? ORDER BY id",
                (incident_id,),
            ).fetchall()
        ]
        draft_row = conn.execute(
            """
            SELECT * FROM comms_drafts
            WHERE incident_id=? ORDER BY created_at DESC LIMIT 1
            """,
            (incident_id,),
        ).fetchone()

    actions_raw = json_loads(d.get("ranked_actions"), [])
    ranked = [RankedAction(**a) for a in actions_raw]

    comms = None
    if draft_row:
        dr = row_to_dict(draft_row)
        comms = {
            "id": dr["id"],
            "body": dr["body"],
            "status": dr["status"],
            "approver": dr.get("approver"),
        }

    return IncidentDetail(
        id=d["id"],
        service=d["service"],
        severity=d["severity"],
        title=d["title"],
        status=d["status"],
        hypothesis=d.get("hypothesis"),
        confidence=d.get("confidence"),
        degraded_flags=chaos.normalize_degraded_flags(json_loads(d.get("degraded_flags"), [])),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
        description=d.get("description"),
        runbook_id=d.get("runbook_id"),
        evidence_refs=json_loads(d.get("evidence_refs"), []),
        ranked_actions=ranked,
        timeline=timeline,
        evidence=evidence,
        transcript=transcript,
        comms_draft=comms,
    )


def _infer_scenario(service: str, title: str) -> str:
    for key, meta in SCENARIOS.items():
        if meta["service"] == service and meta["title"] == title:
            return key
    for key, meta in SCENARIOS.items():
        if meta["service"] == service:
            return key
    return "error_rate"


def run_agent(incident_id: str) -> dict:
    inc = get_incident(incident_id)
    return agent_orchestrator.run_agent(
        incident_id,
        inc.service,
        inc.runbook_id or "payments-error-rate",
        scenario=_infer_scenario(inc.service, inc.title),
    )


def approve_comms(incident_id: str, body: ApproveCommsBody) -> dict:
    now = _now()
    with get_conn() as conn:
        if body.draft_id:
            row = conn.execute(
                "SELECT * FROM comms_drafts WHERE id=? AND incident_id=?",
                (body.draft_id, incident_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT * FROM comms_drafts
                WHERE incident_id=? AND status='pending'
                ORDER BY created_at DESC LIMIT 1
                """,
                (incident_id,),
            ).fetchone()
        if not row:
            if body.draft_id:
                raise HTTPException(status_code=404, detail="Draft not found")
            raise HTTPException(
                status_code=422,
                detail="No pending comms draft — provide draft_id from GET /api/incidents/{id}",
            )
        draft_id = row["id"]
        conn.execute(
            """
            UPDATE comms_drafts SET status='approved', approver=?, decided_at=?
            WHERE id=?
            """,
            (body.approver_name, now, draft_id),
        )
        conn.execute(
            """
            INSERT INTO incident_timeline (incident_id, actor, event_type, message, created_at)
            VALUES (?, ?, 'comms_posted', ?, ?)
            """,
            (incident_id, body.approver_name, "Slack update approved (mock post)", now),
        )
    event_bus.publish("comms.approved", incident_id=incident_id, draft_id=draft_id,
                      approver=body.approver_name)
    return {"status": "approved", "draft_id": draft_id}


def reject_comms(incident_id: str, body: RejectCommsBody) -> dict:
    now = _now()
    with get_conn() as conn:
        if body.draft_id:
            row = conn.execute(
                "SELECT id FROM comms_drafts WHERE id=? AND incident_id=?",
                (body.draft_id, incident_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT id FROM comms_drafts
                WHERE incident_id=? AND status='pending'
                ORDER BY created_at DESC LIMIT 1
                """,
                (incident_id,),
            ).fetchone()
        if not row:
            if body.draft_id:
                raise HTTPException(status_code=404, detail="Draft not found")
            raise HTTPException(
                status_code=422,
                detail="No pending comms draft — provide draft_id from GET /api/incidents/{id}",
            )
        draft_id = row["id"]
        conn.execute(
            """
            UPDATE comms_drafts SET status='rejected', approver=?, reject_reason=?, decided_at=?
            WHERE id=? AND incident_id=?
            """,
            (body.approver_name, body.reason, now, draft_id, incident_id),
        )
    event_bus.publish("comms.rejected", incident_id=incident_id, draft_id=draft_id,
                      reason=body.reason)
    return {"status": "rejected", "draft_id": draft_id}


def reset_demo() -> dict:
    with get_conn() as conn:
        for table in [
            "comms_drafts",
            "agent_transcript_events",
            "incident_logs",
            "evidence_bundles",
            "incident_timeline",
            "incidents",
            "evidence_cache",
            "loop_runs",
        ]:
            conn.execute(f"DELETE FROM {table}")
    chaos.set_flags(
        {
            "mcp_metrics_down": False,
            "mcp_all_down": False,
            "llm_primary_down": False,
            "llm_all_down": False,
        }
    )
    mcp_adapter.seed_all_demo_caches()
    loop_state.reset_scenario_rotation()
    event_bus.publish("demo.reset")
    log_service.emit_log("Demo data reset", source="system", level="info")
    return {
        "status": "reset",
        "reset_at": _now(),
        "seed_version": settings.demo_seed_version,
    }
