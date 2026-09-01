from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


DEFAULT_ALLOWED_ORIGIN_REGEX = (
    r"^https?://(localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|"
    r"192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])"
    r"(?:\.\d{1,3}){2}|[a-zA-Z0-9.-]+\.local)(?::\d+)?$"
)


def _database_path(database_url: str) -> Path:
    prefix = "sqlite:///"
    if not database_url.startswith(prefix):
        raise ValueError("Only sqlite:/// DATABASE_URL values are supported")
    raw_path = database_url[len(prefix) :]
    if not raw_path:
        raise ValueError("DATABASE_URL must include a database path")
    return Path(raw_path).expanduser().resolve()


@dataclass(slots=True)
class Settings:
    api_key: str = ""
    database_url: str = "sqlite:///./marketplace.db"
    request_timeout_seconds: float = 120.0
    health_timeout_seconds: float = 3.0
    health_poll_seconds: float = 10.0
    event_history_limit: int = 100
    max_prompt_characters: int = 50_000
    allowed_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:3000", "http://127.0.0.1:3000"]
    )
    allowed_origin_regex: str | None = DEFAULT_ALLOWED_ORIGIN_REGEX

    @property
    def database_path(self) -> Path:
        return _database_path(self.database_url)

    @classmethod
    def from_env(cls) -> "Settings":
        origins = [
            value.strip()
            for value in os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:3000,http://127.0.0.1:3000",
            ).split(",")
            if value.strip()
        ]
        return cls(
            api_key=os.getenv("MARKETPLACE_API_KEY", ""),
            database_url=os.getenv("DATABASE_URL", "sqlite:///./marketplace.db"),
            request_timeout_seconds=float(os.getenv("REQUEST_TIMEOUT_SECONDS", "120")),
            health_timeout_seconds=float(os.getenv("HEALTH_TIMEOUT_SECONDS", "3")),
            health_poll_seconds=float(os.getenv("HEALTH_POLL_SECONDS", "10")),
            event_history_limit=int(os.getenv("EVENT_HISTORY_LIMIT", "100")),
            max_prompt_characters=int(os.getenv("MAX_PROMPT_CHARACTERS", "50000")),
            allowed_origins=origins,
            allowed_origin_regex=(
                os.getenv("ALLOWED_ORIGIN_REGEX", "").strip()
                or DEFAULT_ALLOWED_ORIGIN_REGEX
            ),
        )
