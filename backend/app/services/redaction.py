"""Strip sensitive patterns from text before LLM gateway calls."""

from __future__ import annotations

import json
import re
from typing import Any

_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"sk-[a-zA-Z0-9]{20,}"), "[REDACTED_KEY]"),
    (re.compile(r"Bearer\s+\S+"), "Bearer [REDACTED]"),
    (re.compile(r"[\w.+-]+@[\w.-]+\.\w+"), "[REDACTED_EMAIL]"),
]


def redact_text(text: str) -> str:
    out = text
    for pattern, repl in _PATTERNS:
        out = pattern.sub(repl, out)
    return out


def redact_json(value: Any) -> Any:
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, dict):
        return {k: redact_json(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact_json(v) for v in value]
    return value


def redact_for_llm(payload: str | dict[str, Any] | list[Any]) -> str:
    if isinstance(payload, (dict, list)):
        text = json.dumps(redact_json(payload), indent=0)
    else:
        text = redact_text(str(payload))
    return text
