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


def test_loop_pause_resume_and_last_scenario_alias(client, demo_auth_headers):
    pause = client.post("/api/admin/loop/pause", headers=demo_auth_headers)
    assert pause.status_code == 200
    body = pause.json()
    assert body["paused"] is True
    assert body.get("last_scenario") == body.get("last_tick_scenario")

    status = client.get("/api/admin/loop/status")
    assert status.status_code == 200
    assert status.json()["paused"] is True
    assert "last_scenario" in status.json()

    resume = client.post("/api/admin/loop/resume", headers=demo_auth_headers)
    assert resume.status_code == 200
    assert resume.json()["paused"] is False


def test_rerun_agent_replaces_transcript_not_stacks(client, demo_auth_headers):
    sim = client.post(
        "/api/demo/simulate-alert",
        json={"scenario": "checkout_errors"},
        headers=demo_auth_headers,
    )
    assert sim.status_code == 200
    incident_id = sim.json()["incident_id"]

    first = client.get(f"/api/incidents/{incident_id}")
    assert first.status_code == 200
    reasoning_first = sum(1 for e in first.json()["transcript"] if e["step"] == "reasoning_line")
    assert reasoning_first >= 1

    rerun = client.post(
        f"/api/incidents/{incident_id}/run-agent",
        headers=demo_auth_headers,
    )
    assert rerun.status_code == 200

    second = client.get(f"/api/incidents/{incident_id}")
    reasoning_second = sum(1 for e in second.json()["transcript"] if e["step"] == "reasoning_line")
    assert reasoning_second == reasoning_first


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
