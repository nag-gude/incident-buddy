"""Shared pytest fixtures — align TestClient with CI/production auth env."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from app.main import app


def _demo_token() -> str | None:
    raw = (os.environ.get("DEMO_TOKEN") or "").strip()
    return raw or None


@pytest.fixture
def demo_auth_headers() -> dict[str, str]:
    """X-Demo-Token when DEMO_TOKEN is set (matches Cloud Run / CI)."""
    token = _demo_token()
    return {"X-Demo-Token": token} if token else {}


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
