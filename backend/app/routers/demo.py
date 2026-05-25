from fastapi import APIRouter, Depends, Header

from app.auth import require_demo_token, verify_admin_token
from app.schemas import DemoResetBody, SimulateAlertBody
from app.services import chaos, incident_service, log_service
from app.config import settings

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/simulate-alert", dependencies=[Depends(require_demo_token)])
def simulate_alert(body: SimulateAlertBody | None = None):
    body = body or SimulateAlertBody()
    return incident_service.simulate_alert(body, source="manual")


@router.post("/reset")
def reset_demo(
    body: DemoResetBody | None = None,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
):
    verify_admin_token(
        header_token=x_admin_token,
        body_token=body.admin_token if body else None,
    )
    return incident_service.reset_demo()


@router.post("/truefoundry-replay")
def truefoundry_replay(
    body: DemoResetBody | None = None,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
):
    """Orchestrate the judge demo: simulate → LLM down → re-run → MCP down → re-run."""
    verify_admin_token(
        header_token=x_admin_token,
        body_token=body.admin_token if body else None,
    )

    chaos.set_flags(
        {
            "llm_primary_down": False,
            "llm_all_down": False,
            "mcp_metrics_down": False,
            "mcp_all_down": False,
        }
    )
    log_service.emit_log(
        "TrueFoundry demo replay started",
        source="system",
        level="info",
    )

    from app.schemas import DemoScenario

    result = incident_service.simulate_alert(
        SimulateAlertBody(scenario=DemoScenario.error_rate),
        source="replay",
    )
    incident_id = result["incident_id"]

    chaos.set_flags({"llm_primary_down": True})
    log_service.emit_log(
        f"Chaos: llm_primary_down enabled for {incident_id}",
        source="system",
        level="warn",
    )
    incident_service.run_agent(incident_id)

    chaos.set_flags({"mcp_metrics_down": True})
    log_service.emit_log(
        f"Chaos: mcp_metrics_down enabled for {incident_id}",
        source="system",
        level="warn",
    )
    incident_service.run_agent(incident_id)

    return {
        "incident_id": incident_id,
        "steps": ["simulate", "llm_primary_down+rerun", "mcp_metrics_down+rerun"],
    }


@router.get("/gateway-trace-sample")
def gateway_trace_sample():
    """Sample gateway trace shape for Devpost documentation."""
    return {
        "calls": [
            {
                "step": "llm.call",
                "model": settings.primary_llm_model,
                "route": "primary",
                "payload": {"purpose": "analysis", "latency_ms": 842, "status": "ok"},
            },
            {
                "step": "gateway_failover",
                "model": settings.openai_fallback_model,
                "route": "fallback",
                "payload": {"recovered_ms": 1200},
            },
        ]
    }
