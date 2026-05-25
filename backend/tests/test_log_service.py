"""Log service unit tests."""

import tempfile
from pathlib import Path

import pytest

from app.config import settings
from app.db import init_db
from app.services import log_service


@pytest.fixture()
def temp_db(monkeypatch):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "test.db"
        monkeypatch.setattr(settings, "database_path", path)
        init_db()
        yield path


def test_emit_and_list_logs(temp_db):
    log_service.emit_log("hello", incident_id="INC-T1", source="agent", level="info")
    log_service.emit_log("world", incident_id="INC-T1", source="gateway", level="warn")

    result = log_service.list_logs("INC-T1")
    assert len(result["logs"]) == 2
    assert result["logs"][0]["message"] == "hello"
    assert result["logs"][1]["source"] == "gateway"


def test_global_logs_includes_incident_scoped(temp_db):
    log_service.emit_log("loop tick", source="system", incident_id=None)
    log_service.emit_log("agent step", source="agent", incident_id="INC-T2")

    result = log_service.list_global_logs(10)
    assert len(result["logs"]) == 2
    messages = [e["message"] for e in result["logs"]]
    assert "loop tick" in messages
    assert "agent step" in messages
