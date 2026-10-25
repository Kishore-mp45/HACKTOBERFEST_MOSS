"""Application configuration loaded from TOML with environment overrides."""

from __future__ import annotations

import os
import tomllib
from functools import lru_cache
from ipaddress import ip_address
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from pydantic import Field, ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="MOSS_",
        env_file=None,
        extra="ignore",
        frozen=True,
    )

    root_path: str = ""
    max_file_size_mb: int = Field(default=50, gt=0)
    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "Qwen3:4b"
    embedding_model: str = "nomic-embed-text:latest"
    llm_timeout_seconds: int = Field(default=120, gt=0)
    embedding_batch_size: int = Field(default=16, gt=0)
    similarity_threshold: float = Field(default=0.75, ge=0, le=1)
    duplicate_threshold: float = Field(default=0.92, ge=0, le=1)
    max_text_chars_for_llm: int = Field(default=12000, gt=0)
    allow_remote_host: bool = False
    host: str = "127.0.0.1"
    port: int = Field(default=8765, ge=1, le=65535)
    log_level: str = "info"
    database_path: str = ""

    @field_validator("ollama_base_url")
    @classmethod
    def normalize_ollama_base_url(cls, value: str) -> str:
        normalized = value.rstrip("/")
        parsed = urlsplit(normalized)
        try:
            is_loopback = parsed.hostname == "localhost" or (
                parsed.hostname is not None and ip_address(parsed.hostname).is_loopback
            )
        except ValueError:
            is_loopback = False
        if parsed.scheme != "http" or not is_loopback:
            raise ValueError("Ollama must be served over HTTP on this machine")
        return normalized

    @field_validator("host")
    @classmethod
    def require_loopback_host(cls, value: str, info: ValidationInfo) -> str:
        allow_remote = (
            info.data.get("allow_remote_host", False)
            or os.environ.get("RENDER", "") == "true"
            or os.environ.get("MOSS_ALLOW_REMOTE_HOST", "").lower() in ("true", "1", "yes")
        )
        if allow_remote:
            if value in ("localhost", "0.0.0.0"):
                return value
            try:
                addr = ip_address(value)
                if addr.is_loopback or addr.is_unspecified:
                    return value
            except ValueError:
                pass
        if value == "localhost":
            return value
        try:
            address = ip_address(value)
        except ValueError as error:
            raise ValueError("Moss server must bind to localhost only") from error
        if not address.is_loopback:
            raise ValueError("Moss server must bind to localhost only")
        return value

    @property
    def database_url(self) -> str:
        if self.database_path:
            database_path = Path(self.database_path).expanduser().resolve()
        else:
            data_directory = Path(
                os.environ.get("LOCALAPPDATA")
                or os.environ.get("XDG_DATA_HOME")
                or (Path.home() / ".local" / "share")
            )
            database_path = data_directory / "Moss" / "moss.db"

        database_path.parent.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{database_path.as_posix()}"


def _flatten_toml(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "root_path": data.get("workspace", {}).get("root_path", ""),
        "max_file_size_mb": data.get("workspace", {}).get("max_file_size_mb", 50),
        "ollama_base_url": data.get("model", {}).get(
            "ollama_base_url", "http://localhost:11434"
        ),
        "llm_model": data.get("model", {}).get("llm_model", "Qwen3:4b"),
        "embedding_model": data.get("model", {}).get(
            "embedding_model", "nomic-embed-text:latest"
        ),
        "llm_timeout_seconds": data.get("model", {}).get("llm_timeout_seconds", 120),
        "embedding_batch_size": data.get("model", {}).get("embedding_batch_size", 16),
        "similarity_threshold": data.get("analysis", {}).get(
            "similarity_threshold", 0.75
        ),
        "duplicate_threshold": data.get("analysis", {}).get(
            "duplicate_threshold", 0.92
        ),
        "max_text_chars_for_llm": data.get("analysis", {}).get(
            "max_text_chars_for_llm", 12000
        ),
        "host": data.get("server", {}).get("host", "127.0.0.1"),
        "port": data.get("server", {}).get("port", 8765),
        "log_level": data.get("server", {}).get("log_level", "info"),
        "database_path": data.get("database", {}).get("path", ""),
    }


def load_settings(config_path: Path | None = None) -> Settings:
    if config_path is None:
        configured_path = os.environ.get("MOSS_CONFIG_FILE")
        default_path = Path(__file__).resolve().parents[1] / "config.toml"
        config_path = Path(configured_path).expanduser() if configured_path else default_path

    file_values: dict[str, Any] = {}
    if config_path.is_file():
        with config_path.open("rb") as config_file:
            file_values = _flatten_toml(tomllib.load(config_file))

    return Settings(**file_values)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return load_settings()
