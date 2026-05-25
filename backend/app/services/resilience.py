"""Resilience score, pulse state, and chaos summary for incident UX."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.db import get_conn, row_to_dict
from app.services import chaos

PULSE_STATES = (
    "stable",
    "investigating",
    "primary_llm_down",
    "fallback_active",
    "mcp_degraded",
    "template_mode",
    "recovery_successful",
)

PULSE_LABELS: dict[str, str] = {
    "stable": "Stable",
    "investigating": "Investigating",
    "primary_llm_down": "Primary LLM Down",
    "fallback_active": "Fallback Active",
    "mcp_degraded": "MCP Degraded",
    "template_mode": "Template Mode",
    "recovery_successful": "Recovery Successful",
}


def _clamp(score: int) -> int:
    return max(0, min(100, score))


def _load_transcript(incident_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT step, payload_json, model, route, degraded, created_at
            FROM agent_transcript_events
            WHERE incident_id=?
            ORDER BY id
            """,
            (incident_id,),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for row in rows:
        d = row_to_dict(row)
        d["payload"] = json.loads(d.pop("payload_json"))
        d["degraded"] = bool(d["degraded"])
        out.append(d)
    return out


def _load_evidence(incident_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT source, status, tool FROM evidence_bundles WHERE incident_id=?",
            (incident_id,),
        ).fetchall()
    return [row_to_dict(r) for r in rows]


def _load_incident(incident_id: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM incidents WHERE id=?", (incident_id,)).fetchone()
    return row_to_dict(row) if row else None


def compute_resilience_score(incident_id: str) -> dict[str, Any]:
    """Demo-grade heuristic score (deterministic from transcript + evidence)."""
    transcript = _load_transcript(incident_id)
    evidence = _load_evidence(incident_id)
    flags = chaos.get_flags()

    score = 100
    factors: list[dict[str, str]] = []

    for ev in evidence:
        if ev["status"] == "error" and ev["source"] == "unavailable":
            score -= 15
            factors.append({"id": "mcp_unrecovered", "label": "MCP tool unavailable", "delta": "-15"})
        elif ev["source"] == "cached":
            score += 8
            factors.append({"id": "cache_recovery", "label": "MCP cache served evidence", "delta": "+8"})

    routes = {t.get("route") for t in transcript if t.get("route")}
    steps = {t["step"] for t in transcript}

    if flags.get("llm_primary_down") or "fallback" in str(routes) or "fallback-after-error" in routes:
        if "template-mode" in routes and flags.get("llm_all_down"):
            score += 5
            factors.append({"id": "template_continuity", "label": "Template mode preserved workflow", "delta": "+5"})
        elif any(r in routes for r in ("fallback", "fallback-after-error")):
            score += 10
            factors.append({"id": "fallback_success", "label": "Gateway fallback succeeded", "delta": "+10"})
        elif flags.get("llm_primary_down") and not flags.get("llm_all_down"):
            score -= 20
            factors.append({"id": "primary_llm_down", "label": "Primary LLM down (pending recovery)", "delta": "-20"})

    if "gateway_failover" in steps:
        score += 10
        factors.append({"id": "failover_event", "label": "Automatic provider failover", "delta": "+10"})

    if "degraded_mode" in steps and score >= 85:
        factors.append({"id": "zero_user_blocking_errors", "label": "No user-blocking errors", "delta": "0"})

    score = _clamp(score)

    # Keep the most informative deltas when multiple events fired.
    seen: set[str] = set()
    unique_factors: list[dict[str, str]] = []
    for f in factors:
        if f["id"] in seen:
            continue
        seen.add(f["id"])
        unique_factors.append(f)

    return {
        "score": score,
        "label": "Resilience Score (demo heuristic)",
        "factors": unique_factors,
    }


def compute_pulse_state(incident_id: str) -> dict[str, str]:
    inc = _load_incident(incident_id)
    if not inc:
        return {"state": "stable", "label": PULSE_LABELS["stable"]}

    flags = chaos.get_flags()
    transcript = _load_transcript(incident_id)
    status = inc.get("status", "open")

    timeline = _load_timeline_events(incident_id)
    comms_posted = any(t.get("event_type") == "comms_posted" for t in timeline)
    if status == "resolved" or comms_posted:
        return {"state": "recovery_successful", "label": PULSE_LABELS["recovery_successful"]}

    if flags.get("llm_all_down"):
        return {"state": "template_mode", "label": PULSE_LABELS["template_mode"]}

    if flags.get("llm_primary_down"):
        routes = {t.get("route") for t in transcript if t.get("route")}
        if "fallback" in routes or "fallback-after-error" in routes:
            return {"state": "fallback_active", "label": PULSE_LABELS["fallback_active"]}
        return {"state": "primary_llm_down", "label": PULSE_LABELS["primary_llm_down"]}

    if flags.get("mcp_metrics_down") or flags.get("mcp_all_down"):
        return {"state": "mcp_degraded", "label": PULSE_LABELS["mcp_degraded"]}

    if status in ("investigating", "open", "mitigated"):
        return {"state": "investigating", "label": PULSE_LABELS["investigating"]}

    return {"state": "stable", "label": PULSE_LABELS["stable"]}


def _load_timeline_events(incident_id: str) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT event_type, message, created_at FROM incident_timeline WHERE incident_id=? ORDER BY id",
            (incident_id,),
        ).fetchall()
    return [row_to_dict(r) for r in rows]


def chaos_summary(incident_id: str) -> dict[str, bool]:
    """Checkmarks for resilience maintained under chaos paths taken."""
    flags = chaos.get_flags()
    transcript = _load_transcript(incident_id)
    routes = {t.get("route") for t in transcript if t.get("route")}
    evidence = _load_evidence(incident_id)

    llm_outage = flags.get("llm_primary_down") or flags.get("llm_all_down")
    llm_recovered = bool(
        routes & {"fallback", "fallback-after-error", "template-mode"}
        or any(t["step"] == "gateway_failover" for t in transcript)
    )

    mcp_timeout = flags.get("mcp_metrics_down") or flags.get("mcp_all_down")
    mcp_recovered = any(e["source"] == "cached" for e in evidence) or not mcp_timeout

    api_brownout = llm_outage or mcp_timeout
    api_recovered = llm_recovered or mcp_recovered

    return {
        "llm_outage": bool(llm_outage and llm_recovered),
        "mcp_timeout": bool(mcp_timeout and mcp_recovered),
        "api_brownout": bool(api_brownout and api_recovered),
    }


def chaos_timeline_events(incident_id: str) -> list[dict[str, str]]:
    """Relative timeline for resilience UI."""
    transcript = _load_transcript(incident_id)
    if not transcript:
        return []

    t0 = datetime.fromisoformat(transcript[0]["created_at"].replace("Z", "+00:00"))
    if t0.tzinfo is None:
        t0 = t0.replace(tzinfo=timezone.utc)

    events: list[dict[str, str]] = [{"label": "Alert", "offset": "+0:00"}]

    for t in transcript:
        ts = datetime.fromisoformat(t["created_at"].replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        delta = int((ts - t0).total_seconds())
        mm, ss = divmod(max(0, delta), 60)
        offset = f"+{mm}:{ss:02d}"

        step = t["step"]
        if step == "gateway_failover":
            events.append({"label": "Gateway failover", "offset": offset})
        elif step == "degraded_mode" and "MCP" in str(t.get("payload", {})):
            events.append({"label": "MCP timeout", "offset": offset})
        elif step == "analyze" and t.get("route") == "fallback":
            events.append({"label": "Fallback activated", "offset": offset})
        elif step == "reasoning_line" and "Confidence" in str(t.get("payload", {}).get("text", "")):
            events.append({"label": "Analysis complete", "offset": offset})

    if len(events) == 1:
        events.append({"label": "Agent investigating", "offset": "+0:02"})

    return events
