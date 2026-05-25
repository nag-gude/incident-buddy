from datetime import datetime, timezone

from app.db import get_conn

# Canonical labels (mutually exclusive LLM tier)
LABEL_LLM_TEMPLATE = "AI offline — template mode"
LABEL_LLM_BACKUP = "Backup LLM active"
LABEL_LLM_TEMPLATE_SUMMARY = "AI summaries in template mode"
LABEL_LLM_BACKUP_REASONING = "Backup reasoning provider active"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _read_flags() -> dict[str, bool]:
    with get_conn() as conn:
        rows = conn.execute("SELECT key, enabled FROM chaos_flags").fetchall()
    return {row["key"]: bool(row["enabled"]) for row in rows}


def reconcile_llm_flags() -> dict[str, bool]:
    """Persist fix when both LLM chaos tiers are enabled (template mode wins)."""
    flags = _read_flags()
    if flags.get("llm_all_down") and flags.get("llm_primary_down"):
        with get_conn() as conn:
            conn.execute(
                """
                UPDATE chaos_flags SET enabled=0, updated_at=?
                WHERE key='llm_primary_down'
                """,
                (_now(),),
            )
        flags["llm_primary_down"] = False
    return flags


def get_flags() -> dict[str, bool]:
    return reconcile_llm_flags()


def set_flags(updates: dict[str, bool]) -> dict[str, bool]:
    # LLM chaos tiers are mutually exclusive — template mode supersedes primary-down.
    updates = dict(updates)
    if updates.get("llm_all_down"):
        updates["llm_primary_down"] = False
    elif updates.get("llm_primary_down"):
        updates["llm_all_down"] = False

    with get_conn() as conn:
        for key, enabled in updates.items():
            conn.execute(
                """
                INSERT INTO chaos_flags (key, enabled, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled, updated_at=excluded.updated_at
                """,
                (key, 1 if enabled else 0, _now()),
            )
    return reconcile_llm_flags()


def is_enabled(key: str) -> bool:
    return get_flags().get(key, False)


def active_degraded_labels() -> list[str]:
    """Chaos-driven labels for the current flag set (LLM tiers are exclusive)."""
    return _labels_from_flags(get_flags(), gateway_configured=None)


def labels_for_health(*, gateway_configured: bool) -> list[str]:
    """Health strip labels — reflect whether a real failover can occur."""
    return _labels_from_flags(get_flags(), gateway_configured=gateway_configured)


def _labels_from_flags(flags: dict[str, bool], *, gateway_configured: bool | None) -> list[str]:
    labels: list[str] = []
    if flags.get("mcp_metrics_down"):
        labels.append("Metrics MCP unavailable")
    if flags.get("mcp_all_down"):
        labels.append("All MCP tools unavailable")
    if flags.get("llm_all_down"):
        labels.append(LABEL_LLM_TEMPLATE)
    elif flags.get("llm_primary_down"):
        if gateway_configured is False:
            labels.append("Primary LLM down — template mode (no gateway keys)")
        else:
            labels.append(LABEL_LLM_BACKUP)
    return labels


def normalize_degraded_flags(flags: list[str]) -> list[str]:
    """Collapse contradictory LLM labels on stored incident rows."""
    if not flags:
        return []

    template_markers = (
        LABEL_LLM_TEMPLATE,
        LABEL_LLM_TEMPLATE_SUMMARY,
        "AI offline",
        "template mode",
    )
    backup_markers = (
        LABEL_LLM_BACKUP,
        LABEL_LLM_BACKUP_REASONING,
        "Backup LLM",
        "Backup reasoning",
    )

    def is_template(s: str) -> bool:
        return any(m.lower() in s.lower() for m in template_markers)

    def is_backup(s: str) -> bool:
        return any(m.lower() in s.lower() for m in backup_markers)

    has_template = any(is_template(f) for f in flags)
    has_backup = any(is_backup(f) for f in flags)

    out: list[str] = []
    for f in flags:
        if has_template and has_backup and is_backup(f):
            continue
        if f not in out:
            out.append(f)
    return out
