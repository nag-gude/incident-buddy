"""Resilience score and pulse state unit tests."""

import json
import sqlite3
import tempfile
from pathlib import Path

import pytest

from app.config import settings
from app.db import init_db
from app.services import resilience


@pytest.fixture()
def temp_db(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "test.db"
        monkeypatch.setattr(settings, "database_path", path)
        init_db()
        incident_id = "INC-TEST01"
        with sqlite3.connect(path) as conn:
            conn.execute(
                """
                INSERT INTO incidents
                (id, service, severity, title, status, created_at, updated_at, archived)
                VALUES (?, 'payments-api', 'P1', 'test', 'investigating', datetime('now'), datetime('now'), 0)
                """,
                (incident_id,),
            )
            conn.execute(
                """
                INSERT INTO evidence_bundles
                (id, incident_id, tool, params_json, result_json, status, source, fetched_at)
                VALUES ('E1', ?, 'metrics.get_snapshot', '{}', '{}', 'ok', 'cached', datetime('now'))
                """,
                (incident_id,),
            )
            conn.execute(
                """
                INSERT INTO agent_transcript_events
                (incident_id, step, payload_json, model, route, degraded, created_at)
                VALUES (?, 'gateway_failover', '{}', 'gpt-3.5-turbo', 'fallback', 1, datetime('now'))
                """,
                (incident_id,),
            )
            conn.commit()
        yield incident_id


def test_resilience_score_cached_evidence_adds_points(temp_db):
    result = resilience.compute_resilience_score(temp_db)
    assert 0 <= result["score"] <= 100
    assert any(f["id"] == "cache_recovery" for f in result["factors"])


def test_pulse_state_investigating(temp_db):
    pulse = resilience.compute_pulse_state(temp_db)
    assert pulse["state"] == "investigating"
    assert pulse["label"] == "Investigating"
