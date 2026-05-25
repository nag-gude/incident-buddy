from app.services import redaction


def test_redact_for_llm_accepts_evidence_list():
    payload = [
        {"id": "EV-1", "tool": "metrics.get_snapshot", "result": {"error_rate_pct": 12.4}},
        {"id": "EV-2", "tool": "deploys.list_recent", "result": {}},
    ]
    out = redaction.redact_for_llm(payload)
    assert "EV-1" in out
    assert "metrics.get_snapshot" in out
    assert isinstance(out, str)


def test_redact_for_llm_accepts_dict():
    out = redaction.redact_for_llm({"hypothesis": "test"})
    assert "hypothesis" in out
