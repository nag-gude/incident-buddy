from app.services.agent_orchestrator import _default_analysis, _default_comms_body


def test_default_comms_body_varies_by_scenario():
    analysis = _default_analysis(
        [{"id": "EV-1", "tool": "metrics.get_snapshot", "status": "ok", "result": {}}],
        "payments-error-rate",
        scenario="saturation",
        service="payments-api",
    )
    error_comms = _default_comms_body("error_rate", "payments-api", analysis)
    sat_comms = _default_comms_body("saturation", "payments-api", analysis)

    assert "5xx" in error_comms
    assert "CPU" in sat_comms
    assert error_comms != sat_comms


def test_default_analysis_hypothesis_varies_by_scenario():
    bundles = [
        {
            "id": "EV-1",
            "tool": "deploys.list_recent",
            "status": "ok",
            "result": {
                "deploys": [{"version": "v3.2.1", "minutes_ago": 42}],
            },
        }
    ]

    error = _default_analysis(
        bundles, "payments-error-rate", scenario="error_rate", service="payments-api"
    )
    checkout = _default_analysis(
        bundles, "payments-error-rate", scenario="checkout_errors", service="checkout-api"
    )

    assert "v3.2.1" in checkout["hypothesis"]
    assert "~42m ago" in checkout["hypothesis"]
    assert error["hypothesis"] != checkout["hypothesis"]
