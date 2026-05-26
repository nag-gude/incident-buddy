from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class DemoScenario(str, Enum):
    error_rate = "error_rate"
    latency = "latency"
    saturation = "saturation"
    checkout_errors = "checkout_errors"
    auth_timeouts = "auth_timeouts"


class AlertWebhookBody(BaseModel):
    service: str
    severity: str = "P2"
    title: str
    description: str = ""
    fired_at: str | None = None
    runbook_id: str | None = None
    dedupe_key: str | None = None


class SimulateAlertBody(BaseModel):
    scenario: DemoScenario = DemoScenario.error_rate


class ChaosUpdateBody(BaseModel):
    flags: dict[str, bool]
    admin_token: str | None = None  # legacy — prefer X-Admin-Token header


class ApproveCommsBody(BaseModel):
    draft_id: str | None = None
    approver_name: str = "on-call engineer"


class RejectCommsBody(BaseModel):
    draft_id: str | None = None
    approver_name: str = "on-call engineer"
    reason: str | None = None


class DemoResetBody(BaseModel):
    """Optional legacy body — prefer X-Admin-Token header."""

    admin_token: str | None = None


class RankedAction(BaseModel):
    rank: int
    title: str
    rationale: str
    runbook_section: str
    risk_level: str
    command_optional: str | None = None


class IncidentSummary(BaseModel):
    id: str
    service: str
    severity: str
    title: str
    status: str
    hypothesis: str | None = None
    confidence: float | None = None
    degraded_flags: list[str] = Field(default_factory=list)
    created_at: str
    updated_at: str


class IncidentDetail(IncidentSummary):
    archived: bool = False
    description: str | None = None
    runbook_id: str | None = None
    evidence_refs: list[str] = Field(default_factory=list)
    ranked_actions: list[RankedAction] = Field(default_factory=list)
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    evidence: list[dict[str, Any]] = Field(default_factory=list)
    transcript: list[dict[str, Any]] = Field(default_factory=list)
    comms_draft: dict[str, Any] | None = None
