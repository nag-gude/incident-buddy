from fastapi import APIRouter

from app.config import settings
from app.services import chaos

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    return {"status": "ok", "service": "incident-buddy-api"}


@router.get("/health/resilience")
def health_resilience():
    flags = chaos.get_flags()
    gateway_configured = bool(
        settings.truefoundry_gateway_url or settings.openai_api_key
    )
    return {
        "chaos_flags": flags,
        "degraded_labels": chaos.labels_for_health(gateway_configured=gateway_configured),
        "gateway_configured": gateway_configured,
        "naive_mode": settings.naive_mode,
        "llm_primary_down": flags.get("llm_primary_down", False),
        "mcp_metrics_down": flags.get("mcp_metrics_down", False),
    }
