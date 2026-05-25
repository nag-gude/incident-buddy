from fastapi import APIRouter

from app.schemas import AlertWebhookBody
from app.services import incident_service

router = APIRouter(tags=["alerts"])


@router.post("/alerts/webhook")
def alerts_webhook(body: AlertWebhookBody):
    return incident_service.create_from_alert(body)
