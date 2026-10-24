from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from moss.config import Settings
from moss.main import create_app


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    return Settings(database_path=str(tmp_path / "moss-test.db"))


@pytest.fixture
def client(tmp_path: Path, settings: Settings) -> Iterator[TestClient]:
    application = create_app(
        settings=settings,
        database_path=tmp_path / "moss-test.db",
        llm_service_factory=lambda: None,
    )
    with TestClient(application) as test_client:
        yield test_client
