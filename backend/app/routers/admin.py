from fastapi import APIRouter, Depends, Header

from app.auth import verify_admin_token
from app.schemas import ChaosUpdateBody
from app.services import chaos

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/chaos")
def get_chaos():
    return {"flags": chaos.get_flags()}


@router.post("/chaos")
def update_chaos(
    body: ChaosUpdateBody,
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
):
    verify_admin_token(header_token=x_admin_token, body_token=body.admin_token)
    return {"flags": chaos.set_flags(body.flags)}
