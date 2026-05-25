import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from app.config import settings


def _ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def init_db() -> None:
    _ensure_parent(settings.database_path)
    with sqlite3.connect(settings.database_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS incidents (
                id TEXT PRIMARY KEY,
                service TEXT NOT NULL,
                severity TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL,
                runbook_id TEXT,
                dedupe_key TEXT,
                hypothesis TEXT,
                confidence REAL,
                evidence_refs TEXT,
                ranked_actions TEXT,
                degraded_flags TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS incident_timeline (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT NOT NULL,
                actor TEXT NOT NULL,
                event_type TEXT NOT NULL,
                message TEXT,
                payload TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents(id)
            );

            CREATE TABLE IF NOT EXISTS evidence_bundles (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                tool TEXT NOT NULL,
                params_json TEXT,
                result_json TEXT NOT NULL,
                status TEXT NOT NULL,
                source TEXT NOT NULL,
                fetched_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents(id)
            );

            CREATE TABLE IF NOT EXISTS evidence_cache (
                service TEXT NOT NULL,
                tool TEXT NOT NULL,
                result_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL,
                PRIMARY KEY (service, tool)
            );

            CREATE TABLE IF NOT EXISTS agent_transcript_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT NOT NULL,
                step TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                model TEXT,
                route TEXT,
                degraded INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents(id)
            );

            CREATE TABLE IF NOT EXISTS comms_drafts (
                id TEXT PRIMARY KEY,
                incident_id TEXT NOT NULL,
                body TEXT NOT NULL,
                status TEXT NOT NULL,
                approver TEXT,
                reject_reason TEXT,
                decided_at TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents(id)
            );

            CREATE TABLE IF NOT EXISTS chaos_flags (
                key TEXT PRIMARY KEY,
                enabled INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS kv_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS loop_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job TEXT NOT NULL,
                scenario TEXT,
                incident_id TEXT,
                live_llm INTEGER NOT NULL DEFAULT 0,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                error TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_loop_runs_started_at
                ON loop_runs(started_at);
            CREATE INDEX IF NOT EXISTS idx_incidents_created_at
                ON incidents(created_at);
            CREATE INDEX IF NOT EXISTS idx_timeline_incident
                ON incident_timeline(incident_id, id);
            CREATE INDEX IF NOT EXISTS idx_transcript_incident
                ON agent_transcript_events(incident_id, id);

            CREATE TABLE IF NOT EXISTS incident_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                incident_id TEXT,
                level TEXT NOT NULL,
                source TEXT NOT NULL,
                message TEXT NOT NULL,
                meta_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                FOREIGN KEY (incident_id) REFERENCES incidents(id)
            );

            CREATE INDEX IF NOT EXISTS idx_incident_logs_incident
                ON incident_logs(incident_id, id);
            """
        )

        # Add archive flag to incidents if upgrading from earlier schema.
        cols = {row[1] for row in conn.execute("PRAGMA table_info(incidents)").fetchall()}
        if "archived" not in cols:
            conn.execute("ALTER TABLE incidents ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")
        if "source" not in cols:
            conn.execute("ALTER TABLE incidents ADD COLUMN source TEXT")

        defaults = [
            "mcp_metrics_down",
            "mcp_all_down",
            "llm_primary_down",
            "llm_all_down",
        ]
        for key in defaults:
            conn.execute(
                """
                INSERT OR IGNORE INTO chaos_flags (key, enabled, updated_at)
                VALUES (?, 0, datetime('now'))
                """,
                (key,),
            )

        # Loop control + session bootstrap
        kv_defaults = {
            "loop:paused": "0",
            "loop:last_tick_at": "",
            "session:last_judge_hit_at": "",
        }
        for key, value in kv_defaults.items():
            conn.execute(
                """
                INSERT OR IGNORE INTO kv_state (key, value, updated_at)
                VALUES (?, ?, datetime('now'))
                """,
                (key, value),
            )
        conn.commit()


@contextmanager
def get_conn():
    init_db()
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row) -> dict:
    return {k: row[k] for k in row.keys()}


def json_loads(value: str | None, default=None):
    if value is None:
        return default if default is not None else []
    return json.loads(value)
