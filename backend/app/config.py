from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_runbooks_dir() -> Path:
    return Path(__file__).resolve().parent.parent.parent / "runbooks"


def _default_database_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "incidentbuddy.db"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_path: Path = Field(default_factory=_default_database_path)
    runbooks_dir: Path = Field(default_factory=_default_runbooks_dir)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    admin_token: str = "dev-admin-change-me"
    naive_mode: bool = False

    truefoundry_gateway_url: str | None = None
    truefoundry_api_key: str | None = None
    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    openai_fallback_model: str = "gpt-3.5-turbo"

    primary_llm_model: str = "nvidia/nemotron"
    primary_llm_provider: str = "crusoe-nemotron"
    fallback_llm_provider: str = "openai"

    demo_seed_version: str = "1.0.0"

    evidence_cache_ttl_minutes: int = 30
    max_llm_calls_per_incident: int = 8

    # Continuous-demo loop (background scheduler)
    demo_loop_enabled: bool = True
    loop_interval_seconds: int = 60           # chaos_tick cadence
    loop_state_step_seconds: int = 15         # incident state-machine advance cadence
    loop_gc_max_incidents: int = 50           # keep newest N
    loop_live_llm_idle_minutes: int = 15      # if no judge hit within window, use fixtures
    loop_max_concurrent_incidents: int = 2

    # Light auth gate for mutating routes
    demo_token: str | None = None             # if set, mutating routes require X-Demo-Token

    # SSE
    sse_keepalive_seconds: int = 15
    sse_queue_size: int = 256


def _strip_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


_settings = Settings()
settings = _settings.model_copy(
    update={
        "admin_token": _settings.admin_token.strip(),
        "demo_token": _strip_optional(_settings.demo_token),
    }
)
