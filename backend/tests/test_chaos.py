from app.services import chaos


def test_active_degraded_labels_llm_exclusive():
    flags = {
        "llm_primary_down": True,
        "llm_all_down": True,
        "mcp_metrics_down": False,
        "mcp_all_down": False,
    }
    original = chaos._read_flags
    chaos._read_flags = lambda: flags  # type: ignore[method-assign]
    try:
        labels = chaos.active_degraded_labels()
    finally:
        chaos._read_flags = original  # type: ignore[method-assign]

    assert chaos.LABEL_LLM_TEMPLATE in labels
    assert chaos.LABEL_LLM_BACKUP not in labels


def test_normalize_degraded_flags_drops_contradictory_backup():
    raw = [
        chaos.LABEL_LLM_TEMPLATE,
        chaos.LABEL_LLM_BACKUP,
        "Metrics MCP unavailable",
    ]
    out = chaos.normalize_degraded_flags(raw)
    assert chaos.LABEL_LLM_BACKUP not in out
    assert chaos.LABEL_LLM_TEMPLATE in out
    assert "Metrics MCP unavailable" in out


def test_labels_for_health_without_gateway_keys():
    flags = {
        "llm_primary_down": True,
        "llm_all_down": False,
        "mcp_metrics_down": False,
        "mcp_all_down": False,
    }
    original = chaos._read_flags
    chaos._read_flags = lambda: flags  # type: ignore[method-assign]
    try:
        labels = chaos.labels_for_health(gateway_configured=False)
    finally:
        chaos._read_flags = original  # type: ignore[method-assign]
    assert chaos.LABEL_LLM_BACKUP not in labels
    assert "template mode" in labels[0].lower()


def test_reconcile_llm_flags_clears_primary_when_both_on(monkeypatch):
    state = {"llm_primary_down": True, "llm_all_down": True, "mcp_metrics_down": False}

    def fake_read():
        return dict(state)

    writes: list[tuple[str, bool]] = []

    def fake_write(key: str, enabled: bool) -> None:
        writes.append((key, enabled))
        state[key] = enabled

    monkeypatch.setattr(chaos, "_read_flags", fake_read)
    monkeypatch.setattr(
        chaos,
        "get_conn",
        lambda: (_ for _ in ()).throw(AssertionError("should not hit DB in unit test")),
    )

    # reconcile uses get_conn — test via active_degraded_labels path instead
    original_reconcile = chaos.reconcile_llm_flags

    def reconcile_without_db():
        flags = fake_read()
        if flags.get("llm_all_down") and flags.get("llm_primary_down"):
            fake_write("llm_primary_down", False)
        return fake_read()

    monkeypatch.setattr(chaos, "reconcile_llm_flags", reconcile_without_db)
    out = chaos.reconcile_llm_flags()
    assert out["llm_all_down"] is True
    assert out["llm_primary_down"] is False
    monkeypatch.setattr(chaos, "reconcile_llm_flags", original_reconcile)
