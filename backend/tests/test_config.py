from pathlib import Path

import pytest
from pydantic import ValidationError

from moss.config import Settings, load_settings


def test_loads_toml_configuration(tmp_path: Path) -> None:
    config_path = tmp_path / "config.toml"
    config_path.write_text(
        '[workspace]\nroot_path = "C:/Documents"\n'
        '[model]\nllm_model = "Qwen3:4b"\n'
        '[database]\npath = "C:/MossData/moss.db"\n',
        encoding="utf-8",
    )

    settings = load_settings(config_path)

    assert settings.root_path == "C:/Documents"
    assert settings.llm_model == "Qwen3:4b"
    assert settings.database_path == "C:/MossData/moss.db"
    assert settings.embedding_model == "nomic-embed-text:latest"


@pytest.mark.parametrize("host", ["0.0.0.0", "192.168.1.10", "moss.example"])
def test_rejects_non_loopback_bind_addresses(host: str) -> None:
    with pytest.raises(ValidationError, match="localhost only"):
        Settings(host=host)


@pytest.mark.parametrize(
    "url",
    [
        "https://ollama.example",
        "http://192.168.1.10:11434",
        "http://0.0.0.0:11434",
    ],
)
def test_rejects_nonlocal_ollama_endpoints(url: str) -> None:
    with pytest.raises(ValidationError, match="this machine"):
        Settings(ollama_base_url=url)


def test_allows_remote_host_when_flag_or_env_enabled(monkeypatch: pytest.MonkeyPatch) -> None:
    # Allowed via explicit argument
    s1 = Settings(host="0.0.0.0", allow_remote_host=True)
    assert s1.host == "0.0.0.0"

    # Allowed via RENDER env
    monkeypatch.setenv("RENDER", "true")
    s2 = Settings(host="0.0.0.0")
    assert s2.host == "0.0.0.0"

    # Allowed via MOSS_ALLOW_REMOTE_HOST env
    monkeypatch.delenv("RENDER", raising=False)
    monkeypatch.setenv("MOSS_ALLOW_REMOTE_HOST", "true")
    s3 = Settings(host="0.0.0.0")
    assert s3.host == "0.0.0.0"

