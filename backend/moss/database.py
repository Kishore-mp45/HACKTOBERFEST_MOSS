"""Async SQLAlchemy database setup."""

from collections.abc import AsyncIterator
from pathlib import Path

from fastapi import Request
from sqlalchemy import event, inspect
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from moss.config import Settings
from moss.models import Base


def create_database(settings: Settings, database_path: Path | None = None):
    database_url = (
        f"sqlite+aiosqlite:///{database_path.resolve().as_posix()}"
        if database_path is not None
        else settings.database_url
    )
    engine = create_async_engine(database_url, future=True)

    @event.listens_for(engine.sync_engine, "connect")
    def enable_sqlite_foreign_keys(connection, _record) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return engine, session_factory


async def initialize_database(engine) -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        extraction_columns = await connection.run_sync(
            lambda sync_connection: {
                column["name"] for column in inspect(sync_connection).get_columns("extractions")
            }
        )
        if "metadata_json" not in extraction_columns:
            await connection.exec_driver_sql(
                "ALTER TABLE extractions "
                "ADD COLUMN metadata_json JSON NOT NULL DEFAULT '{}'"
            )
        execution_columns = await connection.run_sync(
            lambda sync_connection: {
                column["name"]
                for column in inspect(sync_connection).get_columns("execution_records")
            }
        )
        if "content_hash" not in execution_columns:
            await connection.exec_driver_sql(
                "ALTER TABLE execution_records ADD COLUMN content_hash VARCHAR(64)"
            )


async def session_dependency(request: Request) -> AsyncIterator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session
