"""Light auth gate for mutating routes.

When `DEMO_TOKEN` is set, mutating endpoints require `X-Demo-Token: <value>`.
The judging URL embeds the token (`?t=...`), the frontend stashes it in
sessionStorage and attaches it to every API call. The gate is off when
`DEMO_TOKEN` is unset so local development is friction-free."""

from __future__ import annotations

from fastapi import Header, HTTPException, status

from app.config import settings


def require_admin_token(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
) -> None:
    if x_admin_token != settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Admin-Token",
        )


def verify_admin_token(
    *,
    header_token: str | None = None,
    body_token: str | None = None,
) -> None:
    """Accept admin credential from header (preferred) or legacy JSON body."""
    token = header_token or body_token
    if token != settings.admin_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid admin token (use X-Admin-Token header)",
        )


def require_demo_token(x_demo_token: str | None = Header(default=None)) -> None:
    if not settings.demo_token:
        return  # gate disabled in dev
    if x_demo_token != settings.demo_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Demo-Token",
        )
