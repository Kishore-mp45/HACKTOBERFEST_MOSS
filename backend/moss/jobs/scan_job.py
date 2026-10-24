"""Scan job execution."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from moss.ai.llm_service import LLMService
from moss.database import create_database
from moss.models import Job, Workspace
from moss.services.embedding_service import EmbeddingService
from moss.services.recommendation_service import RecommendationService
from moss.services.scanner_service import ScannerService

LOGGER = logging.getLogger(__name__)


async def run_scan_job(
    database_settings,
    job_id: str,
    publish,
    llm_service_factory: Callable[[], LLMService | None] | None = None,
) -> None:
    engine, session_factory = create_database(database_settings)
    try:
        async with session_factory() as session:
            job_result = await session.execute(select(Job).where(Job.id == job_id))
            job = job_result.scalar_one_or_none()
            if job is None:
                await publish({"type": "error", "job_id": job_id, "error": "Job not found"})
                return

            workspace_result = await session.execute(
                select(Workspace).where(Workspace.id == job.workspace_id)
            )
            workspace = workspace_result.scalar_one_or_none()
            if workspace is None:
                job.status = "FAILED"
                job.error_log = [{"error": "Workspace no longer exists"}]
                await session.commit()
                await publish(
                    {
                        "type": "error",
                        "job_id": job_id,
                        "error": "Workspace no longer exists",
                    }
                )
                return

            job.status = "RUNNING"
            job.started_at = datetime.now(UTC)
            job.total_files = 0
            await session.commit()

            async def on_progress(event: dict[str, Any]) -> None:
                if event.get("type") == "progress":
                    job.total_files = int(event.get("total", job.total_files))
                    job.processed_files = int(event.get("processed", job.processed_files))
                    await session.commit()
                await publish({"job_id": job_id, **event})

            try:
                llm_service = (
                    llm_service_factory()
                    if llm_service_factory is not None
                    else None
                )
                if llm_service is None:
                    scanner = ScannerService(database_settings)
                    report = await scanner.scan_workspace(
                        session,
                        workspace,
                        on_progress,
                        force_reindex=job.job_type == "SCAN_FORCE",
                    )
                else:
                    async with llm_service.client:
                        await llm_service.client.ensure_models_available(
                            database_settings.llm_model,
                            database_settings.embedding_model,
                        )
                        scanner = ScannerService(
                            database_settings,
                            llm_service,
                            EmbeddingService(database_settings, llm_service.client),
                        )
                        report = await scanner.scan_workspace(
                            session,
                            workspace,
                            on_progress,
                            force_reindex=job.job_type == "SCAN_FORCE",
                        )
                await RecommendationService(
                    database_settings,
                    llm_service,
                ).generate_recommendations(
                    session,
                    workspace,
                    report,
                    force_reindex=job.job_type == "SCAN_FORCE",
                )
                job.total_files = report["total_files"]
                job.processed_files = report["processed_files"]
                job.error_log = report["errors"]
                job.status = "COMPLETED_WITH_ERRORS" if report["errors"] else "COMPLETED"
                job.finished_at = datetime.now(UTC)
                await session.commit()
                await publish({"type": "complete", "job_id": job_id, **report})
            except Exception as error:
                LOGGER.error("Scan job %s failed (%s)", job_id, type(error).__name__)
                job.status = "FAILED"
                job.error_log = [
                    {
                        "error": (
                            "The scan could not be completed. Check the backend "
                            "logs and verify the configured local AI runtime is available."
                        )
                    }
                ]
                job.finished_at = datetime.now(UTC)
                await session.commit()
                await publish(
                    {
                        "type": "error",
                        "job_id": job_id,
                        "error": (
                            "The scan could not be completed. Check the backend "
                            "logs and verify the configured local AI runtime is available."
                        ),
                    }
                )
    finally:
        await engine.dispose()
