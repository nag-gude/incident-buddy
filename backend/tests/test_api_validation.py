def test_simulate_alert_rejects_unknown_scenario(client, demo_auth_headers):
    res = client.post(
        "/api/demo/simulate-alert",
        json={"scenario": "bogus"},
        headers=demo_auth_headers,
    )
    assert res.status_code == 422


def test_simulate_alert_accepts_valid_scenario(client, demo_auth_headers):
    res = client.post(
        "/api/demo/simulate-alert",
        json={"scenario": "latency"},
        headers=demo_auth_headers,
    )
    assert res.status_code == 200
    assert "incident_id" in res.json()


def test_simulate_alert_requires_demo_token_when_gate_enabled(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "demo_token", "test-gate-token")
    res = client.post("/api/demo/simulate-alert", json={"scenario": "latency"})
    assert res.status_code == 401

    res_ok = client.post(
        "/api/demo/simulate-alert",
        json={"scenario": "latency"},
        headers={"X-Demo-Token": "test-gate-token"},
    )
    assert res_ok.status_code == 200


def test_demo_reset_succeeds_with_admin_token(client):
    res = client.post(
        "/api/demo/reset",
        json={},
        headers={"X-Admin-Token": "dev-admin-change-me"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "reset"
    assert "seed_version" in body
