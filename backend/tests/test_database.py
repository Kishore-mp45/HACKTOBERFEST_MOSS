import asyncio
import sqlite3
from pathlib import Path

from moss.config import Settings
from moss.database import create_database, initialize_database


def test_startup_creates_all_application_tables(client, settings) -> None:
    del client
    with sqlite3.connect(Path(settings.database_path)) as connection:
        table_names = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }

    assert {
        "workspaces",
        "file_records",
        "extractions",
        "classifications",
        "embeddings",
        "document_relationships",
        "duplicate_reviews",
        "collection_reviews",
        "action_items",
        "action_item_reviews",
        "recommendations",
        "proposed_operations",
        "approvals",
        "execution_records",
        "jobs",
    }.issubset(table_names)
    with sqlite3.connect(Path(settings.database_path)) as connection:
        extraction_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(extractions)")
        }
    assert "metadata_json" in extraction_columns


def test_database_startup_adds_metadata_to_existing_extraction_table(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "previous-version.db"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            CREATE TABLE extractions (
                id VARCHAR(36) PRIMARY KEY,
                file_id VARCHAR(36) NOT NULL,
                full_text TEXT NOT NULL,
                word_count INTEGER NOT NULL,
                page_chunks JSON NOT NULL,
                extraction_version VARCHAR(64) NOT NULL,
                extracted_at DATETIME NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE execution_records (
                id VARCHAR(36) PRIMARY KEY,
                proposed_op_id VARCHAR(36) NOT NULL,
                status VARCHAR(32) NOT NULL,
                original_path TEXT NOT NULL,
                final_path TEXT NOT NULL,
                executed_at DATETIME NOT NULL,
                undone BOOLEAN NOT NULL
            )
            """
        )

    async def initialize() -> None:
        engine, _ = create_database(
            Settings(database_path=str(database_path)),
            database_path=database_path,
        )
        try:
            await initialize_database(engine)
        finally:
            await engine.dispose()

    asyncio.run(initialize())
    with sqlite3.connect(database_path) as connection:
        extraction_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(extractions)")
        }
        execution_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(execution_records)")
        }
    assert "metadata_json" in extraction_columns
    assert "content_hash" in execution_columns


def test_default_sqlite_database_is_outside_the_workspace(
    tmp_path: Path,
    monkeypatch,
) -> None:
    workspace = tmp_path / "workspace"
    data_directory = tmp_path / "local-data"
    workspace.mkdir()
    monkeypatch.setenv("LOCALAPPDATA", str(data_directory))
    monkeypatch.delenv("XDG_DATA_HOME", raising=False)
    settings = Settings(root_path=str(workspace))

    database_url = settings.database_url
    database_path = Path(database_url.removeprefix("sqlite+aiosqlite:///")).resolve()

    assert database_path == (data_directory / "Moss" / "moss.db").resolve()
    assert not database_path.is_relative_to(workspace.resolve())
