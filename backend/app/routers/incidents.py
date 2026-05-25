from fastapi import APIRouter, Depends

from app.auth import require_demo_token
from app.schemas import ApproveCommsBody, RejectCommsBody
from app.services import gateway_trace, incident_service, log_service, resilience

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("")
def list_incidents():
    return incident_service.list_incidents()


@router.get("/{incident_id}")
def get_incident(incident_id: str):
    return incident_service.get_incident(incident_id)


@router.post("/{incident_id}/run-agent", dependencies=[Depends(require_demo_token)])
def run_agent(incident_id: str):
    return incident_service.run_agent(incident_id)


@router.post("/{incident_id}/approve-comms", dependencies=[Depends(require_demo_token)])
def approve_comms(incident_id: str, body: ApproveCommsBody):
    return incident_service.approve_comms(incident_id, body)


@router.post("/{incident_id}/reject-comms", dependencies=[Depends(require_demo_token)])
def reject_comms(incident_id: str, body: RejectCommsBody):
    return incident_service.reject_comms(incident_id, body)


@router.get("/{incident_id}/transcript")
def get_transcript(incident_id: str):
    inc = incident_service.get_incident(incident_id)
    return {"incident_id": incident_id, "transcript": inc.transcript}


@router.get("/{incident_id}/resilience-score")
def get_resilience_score(incident_id: str):
    incident_service.get_incident(incident_id)
    return resilience.compute_resilience_score(incident_id)


@router.get("/{incident_id}/resilience-state")
def get_resilience_state(incident_id: str):
    incident_service.get_incident(incident_id)
    pulse = resilience.compute_pulse_state(incident_id)
    return {
        **pulse,
        "chaos_summary": resilience.chaos_summary(incident_id),
        "chaos_timeline": resilience.chaos_timeline_events(incident_id),
    }


@router.get("/{incident_id}/logs")
def get_incident_logs(
    incident_id: str,
    cursor: int | None = None,
    limit: int = 200,
):
    incident_service.get_incident(incident_id)
    return log_service.list_logs(incident_id, cursor=cursor, limit=limit)


@router.get("/{incident_id}/gateway-trace")
def get_gateway_trace(incident_id: str, limit: int = 20):
    incident_service.get_incident(incident_id)
    return gateway_trace.gateway_trace(incident_id, limit=limit)
