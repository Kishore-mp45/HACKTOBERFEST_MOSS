"""FastAPI application factory and lifespan management."""

import os
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from moss.ai.llm_service import LLMService
from moss.ai.ollama_client import OllamaClient
from moss.api.approvals import router as approvals_router
from moss.api.dashboard import router as dashboard_router
from moss.api.files import router as files_router
from moss.api.health import router as health_router
from moss.api.operations import router as operations_router
from moss.api.recommendations import router as recommendations_router
from moss.api.workspace import router as workspace_router
from moss.config import Settings, get_settings
from moss.database import create_database, initialize_database
from moss.jobs.queue import JobQueue
from moss.models import Job


def create_app(
    settings: Settings | None = None,
    database_path: Path | None = None,
    llm_service_factory: Callable[[], LLMService | None] | None = None,
) -> FastAPI:
    app_settings = settings or get_settings()
    if llm_service_factory is None:
        def llm_service_factory() -> LLMService:
            return LLMService(app_settings, OllamaClient(app_settings))

    engine, session_factory = create_database(app_settings, database_path)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        await initialize_database(engine)
        async with session_factory() as session:
            await session.execute(
                update(Job)
                .where(Job.status.in_(["QUEUED", "RUNNING"]))
                .values(status="INTERRUPTED", finished_at=datetime.now(UTC))
            )
            await session.commit()
        job_queue = JobQueue(app_settings, llm_service_factory)
        application.state.job_queue = job_queue
        await job_queue.start()
        try:
            yield
        finally:
            await job_queue.stop()
            await engine.dispose()

    application = FastAPI(
        title="Moss",
        description="Local-first document organization assistant",
        version="0.1.0",
        lifespan=lifespan,
    )
    application.state.settings = app_settings
    application.state.session_factory = session_factory
    application.state.engine = engine
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    custom_origins = os.environ.get("MOSS_CORS_ORIGINS", "")
    if custom_origins:
        for origin in custom_origins.split(","):
            cleaned = origin.strip()
            if cleaned and cleaned not in cors_origins:
                cors_origins.append(cleaned)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_origin_regex=r"https://.*\.onrender\.com",
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )
    application.include_router(health_router)
    application.include_router(dashboard_router)
    application.include_router(files_router)
    application.include_router(recommendations_router)
    application.include_router(approvals_router)
    application.include_router(operations_router)
    application.include_router(workspace_router)
    from moss.api.jobs import router as jobs_router

    application.include_router(jobs_router)
    return application


app = create_app()
