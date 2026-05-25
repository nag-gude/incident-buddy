"""Mock MCP tool adapters with chaos injection and evidence caching."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import settings
from app.db import get_conn
from app.services import chaos


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fixtures(service: str) -> dict[str, Any]:
    profiles: dict[str, dict[str, Any]] = {
        "payments-api": {
            "error_rate_pct": 12.4,
            "p99_latency_ms": 890,
            "cpu_pct": 78,
            "deploys": [
                {
                    "version": "v2.14.0",
                    "author": "ci-bot",
                    "minutes_ago": 18,
                    "changelog": "Payment routing refactor",
                },
                {
                    "version": "v2.13.2",
                    "author": "ci-bot",
                    "minutes_ago": 1440,
                    "changelog": "Hotfix: timeout on checkout",
                },
            ],
            "sample_log": (
                "ERROR payments-api checkout handler: upstream timeout "
                "correlation_id=8f2a1b after deploy v2.14.0"
            ),
            "prior_incident": {
                "id": "INC-1042",
                "title": "Elevated 5xx after deploy",
                "resolution": "Rollback v2.11.1 resolved error spike",
                "days_ago": 12,
            },
        },
        "checkout-api": {
            "error_rate_pct": 4.2,
            "p99_latency_ms": 620,
            "cpu_pct": 54,
            "deploys": [
                {
                    "version": "v3.2.1",
                    "author": "release-bot",
                    "minutes_ago": 42,
                    "changelog": "Cart service gRPC migration",
                },
                {
                    "version": "v3.1.8",
                    "author": "release-bot",
                    "minutes_ago": 2880,
                    "changelog": "Checkout retry policy tweak",
                },
            ],
            "sample_log": (
                "WARN checkout-api /v1/cart/checkout: 503 upstream payments-api "
                "correlation_id=c4e91d after deploy v3.2.1"
            ),
            "prior_incident": {
                "id": "INC-0891",
                "title": "Checkout 503 during peak",
                "resolution": "Circuit breaker + scale-out cleared backlog",
                "days_ago": 21,
            },
        },
        "auth-service": {
            "error_rate_pct": 0.8,
            "p99_latency_ms": 410,
            "cpu_pct": 41,
            "deploys": [
                {
                    "version": "v1.8.3",
                    "author": "platform-ci",
                    "minutes_ago": 67,
                    "changelog": "JWT validation cache tuning",
                },
                {
                    "version": "v1.8.1",
                    "author": "platform-ci",
                    "minutes_ago": 4320,
                    "changelog": "OIDC provider failover hooks",
                },
            ],
            "sample_log": (
                "WARN auth-service token validate: latency p99 890ms "
                "correlation_id=a7b2c9 post-deploy v1.8.3"
            ),
            "prior_incident": {
                "id": "INC-0312",
                "title": "Auth latency elevated (P3)",
                "resolution": "Cache warm + pool bump; no rollback needed",
                "days_ago": 45,
            },
        },
    }
    profile = profiles.get(service, profiles["payments-api"])

    return {
        "metrics.get_snapshot": {
            "service": service,
            "error_rate_pct": profile["error_rate_pct"],
            "error_rate_slo_pct": 1.0,
            "p99_latency_ms": profile["p99_latency_ms"],
            "cpu_pct": profile["cpu_pct"],
            "window_minutes": 15,
            "sample_log": profile["sample_log"],
            "dashboard": f"grafana/d/{service.replace('-', '/')}/errors",
        },
        "deploys.list_recent": {"deploys": profile["deploys"]},
        "incidents.list_recent": {"incidents": [profile["prior_incident"]]},
    }


def _cache_get(service: str, tool: str) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT result_json, fetched_at FROM evidence_cache WHERE service=? AND tool=?",
            (service, tool),
        ).fetchone()
    if not row:
        return None
    fetched = datetime.fromisoformat(row["fetched_at"].replace("Z", "+00:00"))
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    ttl = timedelta(minutes=settings.evidence_cache_ttl_minutes)
    if datetime.now(timezone.utc) - fetched > ttl:
        return None
    return json.loads(row["result_json"])


def _cache_put(service: str, tool: str, result: dict[str, Any]) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO evidence_cache (service, tool, result_json, fetched_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(service, tool) DO UPDATE SET
              result_json=excluded.result_json,
              fetched_at=excluded.fetched_at
            """,
            (service, tool, json.dumps(result), _now()),
        )


def _should_fail(tool: str) -> bool:
    if chaos.is_enabled("mcp_all_down"):
        return True
    if tool == "metrics.get_snapshot" and chaos.is_enabled("mcp_metrics_down"):
        return True
    return False


def call_tool(
    incident_id: str,
    service: str,
    tool: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Invoke MCP tool; persist evidence bundle; return bundle record."""
    params = params or {}
    bundle_id = str(uuid.uuid4())[:8].upper()

    if _should_fail(tool):
        cached = _cache_get(service, tool)
        if cached:
            return _persist_bundle(
                incident_id,
                bundle_id,
                tool,
                params,
                cached,
                status="ok",
                source="cached",
            )
        return _persist_bundle(
            incident_id,
            bundle_id,
            tool,
            params,
            {"error": "MCP tool unavailable", "tool": tool},
            status="error",
            source="unavailable",
        )

    result = _fixtures(service).get(tool, {"note": f"Unknown tool {tool}"})
    _cache_put(service, tool, result)
    return _persist_bundle(
        incident_id,
        bundle_id,
        tool,
        params,
        result,
        status="ok",
        source="live",
    )


def _persist_bundle(
    incident_id: str,
    bundle_id: str,
    tool: str,
    params: dict[str, Any],
    result: dict[str, Any],
    status: str,
    source: str,
) -> dict[str, Any]:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO evidence_bundles
            (id, incident_id, tool, params_json, result_json, status, source, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                bundle_id,
                incident_id,
                tool,
                json.dumps(params),
                json.dumps(result),
                status,
                source,
                _now(),
            ),
        )
    return {
        "id": bundle_id,
        "tool": tool,
        "status": status,
        "source": source,
        "result": result,
    }


def seed_demo_cache(service: str = "payments-api") -> None:
    """Pre-warm evidence cache so MCP chaos shows realistic cached metrics."""
    fixtures = _fixtures(service)
    for tool in ("metrics.get_snapshot", "deploys.list_recent", "incidents.list_recent"):
        if tool in fixtures:
            _cache_put(service, tool, fixtures[tool])


def seed_all_demo_caches() -> None:
    for service in ("payments-api", "checkout-api", "auth-service"):
        seed_demo_cache(service)


def get_runbook(runbook_id: str) -> dict[str, Any]:
    path = settings.runbooks_dir / f"{runbook_id}.md"
    if not path.exists():
        fallback = settings.runbooks_dir / "payments-error-rate.md"
        path = fallback if fallback.exists() else path
    if not path.exists():
        return {"id": runbook_id, "markdown": "# Unknown runbook\n", "sections": []}
    text = path.read_text(encoding="utf-8")
    sections: list[dict[str, str]] = []
    current = {"anchor": "", "title": "", "body": ""}
    for line in text.splitlines():
        if line.startswith("## "):
            if current["title"]:
                sections.append(current)
            title = line[3:].strip()
            anchor = title.lower().replace(" ", "-")
            current = {"anchor": anchor, "title": title, "body": ""}
        else:
            current["body"] += line + "\n"
    if current["title"]:
        sections.append(current)
    return {"id": runbook_id, "markdown": text, "sections": sections}
