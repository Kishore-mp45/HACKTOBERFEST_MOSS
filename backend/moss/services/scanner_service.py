"""Workspace scanning, extraction, and content-hash caching."""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
from collections.abc import Awaitable, Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.ai.llm_service import LLMService
from moss.ai.ollama_client import OllamaError
from moss.ai.output_validator import ModelOutputValidationError
from moss.config import Settings, get_settings
from moss.models import (
    ActionItem,
    Classification,
    DocumentRelationship,
    Embedding,
    Extraction,
    FileRecord,
    ProposedOperation,
    Recommendation,
    Workspace,
)
from moss.parsers import ParseResult, parser_for_path
from moss.security.path_guard import PathGuard
from moss.services.date_verification import verify_date_hint
from moss.services.embedding_service import EmbeddingService

LOGGER = logging.getLogger(__name__)
SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".md", ".markdown", ".txt"}
SCAN_COMMIT_BATCH_SIZE = 25
ProgressCallback = Callable[[dict[str, Any]], Awaitable[None] | None]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _inspect_file(
    path: Path,
    max_file_size_bytes: int,
) -> tuple[os.stat_result | None, str | None, OSError | None]:
    try:
        stat = path.stat()
        digest = (
            None
            if stat.st_size > max_file_size_bytes
            else sha256_file(path)
        )
        return stat, digest, None
    except OSError as error:
        return None, None, error


class ScannerService:
    def __init__(
        self,
        settings: Settings | None = None,
        llm_service: LLMService | None = None,
        embedding_service: EmbeddingService | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.llm_service = llm_service
        self.embedding_service = embedding_service

    def discover_files(self, workspace_root: Path) -> list[Path]:
        root = workspace_root.resolve(strict=True)
        guard = PathGuard(root)
        discovered: list[Path] = []
        for path in root.rglob("*"):
            if path.suffix.casefold() not in SUPPORTED_EXTENSIONS:
                continue
            if path.is_symlink():
                try:
                    safe_path = guard.validate(path)
                except (OSError, RuntimeError, ValueError):
                    LOGGER.warning(
                        "Skipping file outside workspace or with invalid path: %s",
                        path,
                    )
                    continue
                if safe_path.is_file():
                    discovered.append(safe_path)
            elif path.is_file():
                discovered.append(path)
        return sorted(discovered, key=lambda item: item.relative_to(root).as_posix().casefold())

    async def scan_workspace(
        self,
        session: AsyncSession,
        workspace: Workspace,
        progress_callback: ProgressCallback | None = None,
        force_reindex: bool = False,
    ) -> dict[str, Any]:
        root = Path(workspace.root_path).resolve(strict=True)
        files = self.discover_files(root)
        report: dict[str, Any] = {
            "total_files": len(files),
            "processed_files": 0,
            "cache_hits": 0,
            "extracted_files": 0,
            "skipped_too_large": 0,
            "errors": [],
        }
        existing_result = await session.execute(
            select(FileRecord).where(FileRecord.workspace_id == workspace.id)
        )
        records_by_path = {
            record.relative_path: record for record in existing_result.scalars()
        }
        max_file_size_bytes = self.settings.max_file_size_mb * 1024 * 1024
        if files:
            with ThreadPoolExecutor(max_workers=min(64, len(files))) as executor:
                file_metadata = dict(
                    zip(
                        files,
                        executor.map(
                            lambda path: _inspect_file(path, max_file_size_bytes),
                            files,
                        ),
                        strict=True,
                    )
                )
        else:
            file_metadata = {}

        for file_path in files:
            relative_path = file_path.relative_to(root).as_posix()
            record: FileRecord | None = None
            try:
                safe_path = file_path
                stat, digest, metadata_error = file_metadata[file_path]
                if metadata_error is not None:
                    raise metadata_error
                if stat is None:
                    raise OSError("Could not inspect workspace file.")
                too_large = stat.st_size > max_file_size_bytes
                record = records_by_path.get(relative_path)

                if too_large:
                    if record is not None:
                        extraction_result = await session.execute(
                            select(Extraction).where(Extraction.file_id == record.id)
                        )
                        old_extraction = extraction_result.scalar_one_or_none()
                        if old_extraction is not None:
                            await session.delete(old_extraction)
                    record = await self._record_file(
                        session,
                        workspace,
                        record,
                        relative_path,
                        safe_path,
                        digest,
                        stat.st_size,
                        stat.st_mtime,
                        "SKIPPED_TOO_LARGE",
                    )
                    records_by_path[relative_path] = record
                    report["skipped_too_large"] += 1
                    await self._emit_progress(
                        progress_callback,
                        {
                            "type": "progress",
                            "stage": "skipped",
                            "current_file": relative_path,
                            "processed": report["processed_files"] + 1,
                            "total": report["total_files"],
                        },
                    )
                elif (
                    record is not None
                    and record.sha256_hash == digest
                    and record.file_mtime == stat.st_mtime
                    and record.status
                    in {
                        "EXTRACTED",
                        "EXTRACTED_WITH_ERRORS",
                        "ANALYZED",
                        "CLASSIFICATION_FAILED",
                        "ACTION_EXTRACTION_FAILED",
                        "ANALYSIS_FAILED",
                    }
                    and not force_reindex
                ):
                    report["cache_hits"] += 1
                    LOGGER.info("Cache hit for %s", relative_path)
                    if self.llm_service is not None and record.status != "ANALYZED":
                        extraction_result = await session.execute(
                            select(Extraction).where(Extraction.file_id == record.id)
                        )
                        extraction = extraction_result.scalar_one_or_none()
                        if extraction is not None:
                            await self._analyze_record(
                                session,
                                record,
                                extraction.full_text,
                                relative_path,
                                report,
                                progress_callback,
                                force_reindex,
                            )
                    await self._emit_progress(
                        progress_callback,
                        {
                            "type": "progress",
                            "stage": "cache",
                            "current_file": relative_path,
                            "processed": report["processed_files"] + 1,
                            "total": report["total_files"],
                        },
                    )
                else:
                    if record is not None and (
                        record.sha256_hash != digest
                        or record.file_mtime != stat.st_mtime
                    ):
                        stale_recommendations = await session.execute(
                            select(Recommendation).where(
                                Recommendation.file_id == record.id,
                                Recommendation.status.in_(["PENDING", "CONFLICT"]),
                            )
                        )
                        for recommendation in stale_recommendations.scalars():
                            operation_result = await session.execute(
                                select(ProposedOperation).where(
                                    ProposedOperation.recommendation_id
                                    == recommendation.id
                                )
                            )
                            operation = operation_result.scalar_one_or_none()
                            if operation is not None:
                                await session.delete(operation)
                            await session.delete(recommendation)
                        await session.execute(
                            delete(Classification).where(
                                Classification.file_id == record.id
                            )
                        )
                        await session.execute(
                            delete(ActionItem).where(ActionItem.file_id == record.id)
                        )
                        await session.execute(
                            delete(Embedding).where(Embedding.file_id == record.id)
                        )
                        await session.execute(
                            delete(DocumentRelationship).where(
                                or_(
                                    DocumentRelationship.file_a_id == record.id,
                                    DocumentRelationship.file_b_id == record.id,
                                )
                            )
                        )
                    result = parser_for_path(safe_path).parse(safe_path)
                    record = await self._record_file(
                        session,
                        workspace,
                        record,
                        relative_path,
                        safe_path,
                        digest,
                        stat.st_size,
                        stat.st_mtime,
                        "EXTRACTED" if not result.error else "EXTRACTED_WITH_ERRORS",
                    )
                    records_by_path[relative_path] = record
                    extraction_result = await session.execute(
                        select(Extraction).where(Extraction.file_id == record.id)
                    )
                    extraction = extraction_result.scalar_one_or_none()
                    if extraction is None:
                        extraction = Extraction(file_id=record.id, full_text=result.text)
                        session.add(extraction)
                    self._update_extraction(extraction, result)
                    report["extracted_files"] += 1
                    if result.error:
                        report["errors"].append(
                            {"file": relative_path, "error": result.error}
                        )
                    if self.llm_service is not None:
                        await self._analyze_record(
                            session,
                            record,
                            result.text,
                            relative_path,
                            report,
                            progress_callback,
                            force_reindex,
                        )
                    await self._emit_progress(
                        progress_callback,
                        {
                            "type": "progress",
                            "stage": "extraction",
                            "current_file": relative_path,
                            "processed": report["processed_files"] + 1,
                            "total": report["total_files"],
                        },
                    )
            except Exception as error:
                LOGGER.error(
                    "Failed to process workspace file %s (%s)",
                    relative_path,
                    type(error).__name__,
                )
                report["errors"].append(
                    {
                        "file": relative_path,
                        "error": (
                            f"{type(error).__name__}: Could not process this file; "
                            "check the backend logs."
                        ),
                    }
                )
                if record is None:
                    try:
                        stat = file_path.stat()
                        digest = (
                            sha256_file(file_path)
                            if stat.st_size <= self.settings.max_file_size_mb * 1024 * 1024
                            else None
                        )
                        record = records_by_path.get(relative_path)
                        record = await self._record_file(
                            session,
                            workspace,
                            record,
                            relative_path,
                            file_path,
                            digest,
                            stat.st_size,
                            stat.st_mtime,
                            "EXTRACTION_FAILED",
                        )
                        records_by_path[relative_path] = record
                    except (OSError, RuntimeError):
                        LOGGER.error(
                            "Could not persist failed file record for %s",
                            relative_path,
                        )
                else:
                    record.status = "EXTRACTION_FAILED"
                if record is not None:
                    extraction_result = await session.execute(
                        select(Extraction).where(Extraction.file_id == record.id)
                    )
                    old_extraction = extraction_result.scalar_one_or_none()
                    if old_extraction is not None:
                        await session.delete(old_extraction)
                await self._emit_progress(
                    progress_callback,
                    {
                        "type": "progress",
                        "stage": "error",
                        "current_file": relative_path,
                        "processed": report["processed_files"] + 1,
                        "total": report["total_files"],
                    },
                )
            finally:
                report["processed_files"] += 1
                if (
                    report["processed_files"] % SCAN_COMMIT_BATCH_SIZE == 0
                    or report["processed_files"] == report["total_files"]
                ) and (session.new or session.dirty or session.deleted):
                    await session.commit()

        if self.embedding_service is not None:
            await self.embedding_service.process_workspace(
                session,
                workspace,
                report,
                force_reindex=force_reindex,
            )

        workspace.last_scanned_at = datetime.now(UTC)
        await session.commit()
        return report

    async def _record_file(
        self,
        session: AsyncSession,
        workspace: Workspace,
        record: FileRecord | None,
        relative_path: str,
        path: Path,
        digest: str | None,
        size: int,
        mtime: float,
        file_status: str,
    ) -> FileRecord:
        if record is None:
            record = FileRecord(
                workspace_id=workspace.id,
                relative_path=relative_path,
                absolute_path=str(path),
            )
            session.add(record)
        record.absolute_path = str(path)
        record.sha256_hash = digest
        record.file_size_bytes = size
        record.file_mtime = mtime
        record.mime_type = mimetypes.guess_type(path.name)[0]
        record.status = file_status
        record.indexed_at = datetime.now(UTC)
        await session.flush()
        return record

    @staticmethod
    def _update_extraction(extraction: Extraction, result: ParseResult) -> None:
        extraction.full_text = result.text
        extraction.word_count = result.word_count
        extraction.page_chunks = result.page_chunks
        extraction.metadata_json = result.metadata
        extraction.extraction_version = result.extraction_version
        extraction.extracted_at = datetime.now(UTC)

    async def _analyze_record(
        self,
        session: AsyncSession,
        record: FileRecord,
        document_text: str,
        relative_path: str,
        report: dict[str, Any],
        progress_callback: ProgressCallback | None,
        force_reindex: bool,
    ) -> None:
        if self.llm_service is None:
            return

        failed_stages: list[str] = []
        classification_result = await session.execute(
            select(Classification).where(Classification.file_id == record.id)
        )
        classification = classification_result.scalar_one_or_none()
        if classification is None or force_reindex:
            try:
                output = await self.llm_service.classify_document(document_text)
                if classification is None:
                    classification = Classification(file_id=record.id, **output.model_dump())
                    session.add(classification)
                else:
                    for key, value in output.model_dump().items():
                        setattr(classification, key, value)
                await session.flush()
            except (OllamaError, ModelOutputValidationError) as error:
                failed_stages.append("classification")
                report["errors"].append(
                    {
                        "file": relative_path,
                        "stage": "classification",
                        "error": (
                            f"{type(error).__name__}: Classification failed; "
                            "check the backend logs."
                        ),
                    }
                )
                LOGGER.error(
                    "Classification failed for %s (%s)",
                    relative_path,
                    type(error).__name__,
                )

        actions_result = await session.execute(
            select(ActionItem).where(ActionItem.file_id == record.id)
        )
        existing_actions = list(actions_result.scalars())
        if not existing_actions or force_reindex:
            try:
                actions_output = await self.llm_service.extract_actions(document_text)
                if force_reindex:
                    for item in existing_actions:
                        await session.delete(item)
                seen_actions: set[tuple[str, str]] = set()
                for action in actions_output.items:
                    action_key = (
                        " ".join(action.description.casefold().split()),
                        " ".join(action.source_text.casefold().split()),
                    )
                    if action_key in seen_actions:
                        continue
                    seen_actions.add(action_key)
                    session.add(
                        ActionItem(
                            file_id=record.id,
                            item_type=action.type,
                            description=action.description,
                            source_text=action.source_text,
                            date_hint=action.date_hint,
                            date_verified=verify_date_hint(action.date_hint),
                            assignee_hint=action.assignee_hint,
                            confidence=action.confidence,
                        )
                    )
                await session.flush()
            except (OllamaError, ModelOutputValidationError) as error:
                failed_stages.append("action extraction")
                report["errors"].append(
                    {
                        "file": relative_path,
                        "stage": "action extraction",
                        "error": (
                            f"{type(error).__name__}: Action extraction failed; "
                            "check the backend logs."
                        ),
                    }
                )
                LOGGER.error(
                    "Action extraction failed for %s (%s)",
                    relative_path,
                    type(error).__name__,
                )

        if "classification" in failed_stages and "action extraction" in failed_stages:
            record.status = "ANALYSIS_FAILED"
        elif "classification" in failed_stages:
            record.status = "CLASSIFICATION_FAILED"
        elif "action extraction" in failed_stages:
            record.status = "ACTION_EXTRACTION_FAILED"
        else:
            record.status = "ANALYZED"

        await self._emit_progress(
            progress_callback,
            {
                "type": "progress",
                "stage": "analysis",
                "current_file": relative_path,
                "processed": report["processed_files"] + 1,
                "total": report["total_files"],
            },
        )

    @staticmethod
    async def _emit_progress(
        callback: ProgressCallback | None,
        event: dict[str, Any],
    ) -> None:
        if callback is None:
            return
        result = callback(event)
        if result is not None:
            await result
