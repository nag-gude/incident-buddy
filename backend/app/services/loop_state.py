"""Loop control + judge-session tracking, backed by the kv_state table.

Two pieces of state live here:
- `loop:paused`               — pause/resume toggle for the chaos scheduler
- `session:last_judge_hit_at` — most recent ping from the dashboard; the
  scheduler uses this to decide whether to spend live LLM quota
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db import get_conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _kv_get(key: str) -> str:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM kv_state WHERE key=?", (key,)).fetchone()
    return row["value"] if row else ""


def _kv_set(key: str, value: str) -> None:
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO kv_state (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            """,
            (key, value, _now()),
        )


# ---- loop pause/resume ----

def is_paused() -> bool:
    return _kv_get("loop:paused") == "1"


def set_paused(paused: bool) -> None:
    _kv_set("loop:paused", "1" if paused else "0")


def mark_tick(scenario: str | None = None) -> None:
    _kv_set("loop:last_tick_at", _now())
    if scenario:
        _kv_set("loop:last_tick_scenario", scenario)


def last_tick_at() -> str | None:
    v = _kv_get("loop:last_tick_at")
    return v or None


def last_tick_scenario() -> str | None:
    v = _kv_get("loop:last_tick_scenario")
    return v or None


def next_scenario(presets: list[str]) -> str:
    """Round-robin through demo scenarios so the inbox stays varied."""
    if not presets:
        return "error_rate"
    idx = int(_kv_get("loop:scenario_idx") or "0")
    scenario = presets[idx % len(presets)]
    _kv_set("loop:scenario_idx", str((idx + 1) % len(presets)))
    return scenario


def reset_scenario_rotation() -> None:
    _kv_set("loop:scenario_idx", "0")


def ping_session() -> str:
    ts = _now()
    _kv_set("session:last_judge_hit_at", ts)
    return ts


def last_judge_hit_at() -> datetime | None:
    v = _kv_get("session:last_judge_hit_at")
    if not v:
        return None
    try:
        return datetime.fromisoformat(v)
    except ValueError:
        return None


def judge_recently_active(window_minutes: int) -> bool:
    last = last_judge_hit_at()
    if last is None:
        return False
    return datetime.now(timezone.utc) - last < timedelta(minutes=window_minutes)


# ---- combined snapshot ----

def status() -> dict:
    return {
        "paused": is_paused(),
        "last_tick_at": last_tick_at(),
        "last_tick_scenario": last_tick_scenario(),
        "last_judge_hit_at": _kv_get("session:last_judge_hit_at") or None,
    }
