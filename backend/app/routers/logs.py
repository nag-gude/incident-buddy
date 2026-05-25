from fastapi import APIRouter, Query

from app.services import log_service

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("/global")
def global_logs(limit: int = Query(100, ge=1, le=500)):
    return log_service.list_global_logs(limit)
