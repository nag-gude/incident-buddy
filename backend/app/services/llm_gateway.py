"""LLM access via TrueFoundry AI Gateway (OpenAI-compatible) with fallbacks."""

from __future__ import annotations

import json
import time
from typing import Any

import httpx

from app.config import settings
from app.services import chaos


class LLMResult:
    def __init__(
        self,
        text: str,
        model: str,
        route: str,
        provider: str = "openai",
        degraded: bool = False,
        failover_ms: int | None = None,
        latency_ms: int | None = None,
        purpose: str = "analysis",
        status: str = "ok",
    ):
        self.text = text
        self.model = model
        self.route = route
        self.provider = provider
        self.degraded = degraded
        self.failover_ms = failover_ms
        self.latency_ms = latency_ms
        self.purpose = purpose
        self.status = status


def _gateway_base() -> str:
    url = settings.truefoundry_gateway_url
    if url:
        return url.rstrip("/")
    if settings.openai_api_key:
        return "https://api.openai.com/v1"
    raise RuntimeError("No LLM gateway configured")


def _api_key() -> str:
    key = settings.truefoundry_api_key or settings.openai_api_key
    if not key:
        raise RuntimeError("No LLM API key configured")
    return key


def _chat(
    model: str,
    messages: list[dict[str, str]],
    route_label: str,
    provider: str,
    purpose: str,
) -> LLMResult:
    base = _gateway_base()
    url = f"{base}/chat/completions"
    headers = {
        "Authorization": f"Bearer {_api_key()}",
        "Content-Type": "application/json",
    }
    body = {
        "model": model,
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.2,
    }
    started = time.monotonic()
    with httpx.Client(timeout=45.0) as client:
        resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
    latency_ms = int((time.monotonic() - started) * 1000)
    content = data["choices"][0]["message"]["content"]
    return LLMResult(
        text=content,
        model=model,
        route=route_label,
        provider=provider,
        degraded=False,
        latency_ms=latency_ms,
        purpose=purpose,
        status="ok",
    )


def complete(
    system: str,
    user: str,
    *,
    purpose: str = "analysis",
) -> LLMResult:
    """
    Call LLM with resilience:
    - llm_all_down → template
    - llm_primary_down → skip primary, use fallback model
    - naive_mode → raise to simulate brittle agent
    """
    if settings.naive_mode:
        raise RuntimeError("NAIVE_MODE: LLM call not wrapped with resilience")

    if chaos.is_enabled("llm_all_down"):
        return _template_response(purpose)

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    primary_model = settings.primary_llm_model
    fallback_model = settings.openai_fallback_model
    primary_provider = settings.primary_llm_provider
    fallback_provider = settings.fallback_llm_provider

    started = time.monotonic()

    try:
        if chaos.is_enabled("llm_primary_down"):
            result = _chat(fallback_model, messages, "fallback", fallback_provider, purpose)
            result.failover_ms = int((time.monotonic() - started) * 1000)
            result.status = "failover"
            return result
        return _chat(primary_model, messages, "primary", primary_provider, purpose)
    except Exception:
        try:
            if not chaos.is_enabled("llm_primary_down"):
                result = _chat(
                    fallback_model,
                    messages,
                    "fallback-after-error",
                    fallback_provider,
                    purpose,
                )
                result.failover_ms = int((time.monotonic() - started) * 1000)
                result.status = "failover"
                return result
        except Exception:
            pass
        return _template_response(purpose)


def _template_response(purpose: str) -> LLMResult:
    if purpose == "comms":
        # Orchestrator supplies scenario-aware comms via _default_comms_body().
        text = ""
    else:
        text = (
            "Suspected regression related to recent deploy (see evidence bundles). "
            "Recommended: review error rate dashboard, consider rollback per runbook §4."
        )
    return LLMResult(
        text=text,
        model="template",
        route="template-mode",
        provider="template",
        degraded=True,
        latency_ms=0,
        purpose=purpose,
        status="template",
    )


def parse_json_block(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("{"):
        return json.loads(text)
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])
    return {"raw": text}
