from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_simulate_alert_rejects_unknown_scenario():
    res = client.post("/api/demo/simulate-alert", json={"scenario": "bogus"})
    assert res.status_code == 422


def test_simulate_alert_accepts_valid_scenario():
    res = client.post("/api/demo/simulate-alert", json={"scenario": "latency"})
    assert res.status_code == 200
    assert "incident_id" in res.json()


def test_demo_reset_succeeds_with_admin_token():
    res = client.post(
        "/api/demo/reset",
        json={},
        headers={"X-Admin-Token": "dev-admin-change-me"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "reset"
    assert "seed_version" in body
