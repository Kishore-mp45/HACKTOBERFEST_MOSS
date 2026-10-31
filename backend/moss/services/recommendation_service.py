"""Deterministic, evidence-backed organization recommendations."""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.ai.llm_service import LLMService
from moss.ai.ollama_client import OllamaError
from moss.ai.output_validator import ModelOutputValidationError
from moss.config import Settings
from moss.models import (
    Classification,
    DocumentRelationship,
    Extraction,
    FileRecord,
    ProposedOperation,
    Recommendation,
    Workspace,
)
from moss.security.filename_sanitizer import sanitize_filename

LOGGER = logging.getLogger(__name__)
_GENERIC_FILENAME = re.compile(
    r"^(?:document|doc|file|notes?|untitled|scan|new(?:[ _-]?file)?|image)"
    r"(?:[ _-]?\d+)?$",
    re.IGNORECASE,
)
_CONFIDENCE_WEIGHT = {"high": 1.0, "medium": 0.7, "low": 0.4}


def is_generic_filename(filename: str) -> bool:
    # relative_path may use either separator; pathlib only splits on the
    # native one, so strip both explicitly before checking the stem.
    name = filename.replace("\\", "/").rsplit("/", 1)[-1]
    return _GENERIC_FILENAME.fullmatch(Path(name).stem.strip()) is not None


def recommendation_rank(
    confidence: str,
    file_mtime: float | None,
    now: datetime | None = None,
) -> float:
    confidence_score = _CONFIDENCE_WEIGHT.get(confidence.casefold(), 0.4)
    if file_mtime is None:
        return round(confidence_score * 0.5, 4)
    reference = now or datetime.now(UTC)
    age_days = max(0.0, (reference.timestamp() - file_mtime) / 86400)
    recency_score = 1 / (1 + age_days / 365)
    return round(confidence_score * recency_score, 4)


class RecommendationService:
    def __init__(
        self,
        settings: Settings,
        llm_service: LLMService | None = None,
    ) -> None:
        self.settings = settings
        self.llm_service = llm_service

    async def generate_recommendations(
        self,
        session: AsyncSession,
        workspace: Workspace,
        report: dict[str, Any],
        force_reindex: bool = False,
    ) -> None:
        file_result = await session.execute(
            select(FileRecord).where(FileRecord.workspace_id == workspace.id)
        )
        files = list(file_result.scalars())
        files_by_id = {record.id: record for record in files}
        file_ids = list(files_by_id)
        if not file_ids:
            report["recommendations_generated"] = 0
            return

        classification_result = await session.execute(
            select(Classification).where(Classification.file_id.in_(file_ids))
        )
        classifications = {
            item.file_id: item for item in classification_result.scalars()
        }
        extraction_result = await session.execute(
            select(Extraction).where(Extraction.file_id.in_(file_ids))
        )
        extractions = {item.file_id: item for item in extraction_result.scalars()}
        recommendation_result = await session.execute(
            select(Recommendation).where(Recommendation.file_id.in_(file_ids))
        )
        existing = {
            (item.file_id, item.rec_type): item
            for item in recommendation_result.scalars()
        }
        if force_reindex:
            for recommendation in existing.values():
                await session.execute(
                    delete(ProposedOperation).where(
                        ProposedOperation.recommendation_id == recommendation.id
                    )
                )
                await session.delete(recommendation)
            await session.flush()
            existing = {}
        else:
            for recommendation in existing.values():
                if recommendation.status not in {"PENDING", "CONFLICT"}:
                    continue
                operation_result = await session.execute(
                    select(ProposedOperation).where(
                        ProposedOperation.recommendation_id == recommendation.id
                    )
                )
                operation = operation_result.scalar_one_or_none()
                if operation is not None:
                    has_conflict = (
                        Path(operation.dest_path).exists()
                        and Path(operation.dest_path) != Path(operation.source_path)
                    )
                    recommendation.status = (
                        "CONFLICT" if has_conflict else "PENDING"
                    )
        relationship_result = await session.execute(
            select(DocumentRelationship).where(
                or_(
                    DocumentRelationship.file_a_id.in_(file_ids),
                    DocumentRelationship.file_b_id.in_(file_ids),
                )
            )
        )
        relationships = list(relationship_result.scalars())
        generated = 0

        cluster_members: dict[str, set[str]] = defaultdict(set)
        for relationship in relationships:
            if relationship.cluster_id:
                cluster_members[relationship.cluster_id].update(
                    (relationship.file_a_id, relationship.file_b_id)
                )

        for relationship in relationships:
            if relationship.relationship_type not in {
                "EXACT_DUPLICATE",
                "NEAR_DUPLICATE",
            }:
                continue
            file_a = files_by_id.get(relationship.file_a_id)
            file_b = files_by_id.get(relationship.file_b_id)
            if file_a is None or file_b is None:
                continue
            explanation = (
                f"{relationship.relationship_type.replace('_', ' ').title()} "
                f"candidate with {file_b.relative_path} "
                f"(similarity {relationship.similarity_score:.3f})."
            )
            added = await self._add_recommendation(
                session,
                existing,
                file_a,
                "duplicate_review",
                explanation,
                "high"
                if relationship.relationship_type == "EXACT_DUPLICATE"
                else "medium",
            )
            generated += int(added)

        root = Path(workspace.root_path).resolve()
        for cluster_id, member_ids in cluster_members.items():
            members = [
                files_by_id[item_id]
                for item_id in sorted(member_ids)
                if item_id in files_by_id
            ]
            if len(members) < 2:
                continue
            for record in members:
                classification = classifications.get(record.id)
                topic = classification.topic if classification else "Related Documents"
                folder_name = sanitize_filename(topic).strip()
                if Path(folder_name).suffix:
                    folder_name = Path(folder_name).stem
                folder_name = folder_name or "Related Documents"
                peers = [peer for peer in members if peer.id != record.id]
                peer_names = ", ".join(peer.relative_path for peer in peers[:3])
                added = await self._add_recommendation(
                    session,
                    existing,
                    record,
                    "group_tag",
                    f"Grouped with semantically related files ({peer_names}); "
                    f"the shared cluster topic is {topic}.",
                    classification.confidence if classification else "medium",
                )
                generated += int(added)

                peer_directories = {Path(peer.absolute_path).parent for peer in members}
                if len(peer_directories) < 2:
                    continue
                destination_directory = root / "Related" / folder_name
                destination = destination_directory / Path(record.absolute_path).name
                if destination == Path(record.absolute_path):
                    continue
                status = "CONFLICT" if destination.exists() else "PENDING"
                added = await self._add_recommendation(
                    session,
                    existing,
                    record,
                    "move",
                    f"Move this file into {destination_directory} to co-locate it "
                    f"with its semantic cluster ({peer_names})."
                    + (
                        " The proposed destination already exists."
                        if status == "CONFLICT"
                        else ""
                    ),
                    classification.confidence if classification else "medium",
                    operation=ProposedOperation(
                        op_type="MOVE",
                        source_path=record.absolute_path,
                        dest_path=str(destination),
                    ),
                    status=status,
                )
                generated += int(added)

        if self.llm_service is not None:
            for record in files:
                if not is_generic_filename(record.relative_path):
                    continue
                classification = classifications.get(record.id)
                extraction = extractions.get(record.id)
                if classification is None or extraction is None:
                    continue
                try:
                    suggestion = await self.llm_service.suggest_filename(
                        extraction.full_text
                    )
                    filename = sanitize_filename(suggestion.filename)
                    current_path = Path(record.absolute_path)
                    current_suffix = current_path.suffix
                    proposed_stem = Path(filename).stem
                    if current_suffix:
                        filename = sanitize_filename(proposed_stem + current_suffix)
                    if filename.casefold() == current_path.name.casefold():
                        continue
                    destination = current_path.with_name(filename)
                    if destination == current_path:
                        continue
                    destination_status = "CONFLICT" if destination.exists() else "PENDING"
                    operation = ProposedOperation(
                        op_type="RENAME",
                        source_path=record.absolute_path,
                        dest_path=str(destination),
                        new_name=filename,
                    )
                    added = await self._add_recommendation(
                        session,
                        existing,
                        record,
                        "rename",
                        suggestion.reason
                        + (
                            " The proposed destination already exists."
                            if destination_status == "CONFLICT"
                            else ""
                        ),
                        classification.confidence,
                        operation=operation,
                        status=destination_status,
                    )
                    generated += int(added)
                except (OllamaError, ModelOutputValidationError, ValueError) as error:
                    report["errors"].append(
                        {
                            "file": record.relative_path,
                            "stage": "rename recommendation",
                            "error": (
                                f"{type(error).__name__}: A filename recommendation "
                                "could not be generated; check the backend logs."
                            ),
                        }
                    )
                    LOGGER.error(
                        "Filename recommendation failed for %s (%s)",
                        record.relative_path,
                        type(error).__name__,
                    )

        report["recommendations_generated"] = generated
        await session.flush()

    async def _add_recommendation(
        self,
        session: AsyncSession,
        existing: dict[tuple[str, str], Recommendation],
        record: FileRecord,
        rec_type: str,
        explanation: str,
        confidence: str,
        operation: ProposedOperation | None = None,
        status: str = "PENDING",
    ) -> bool:
        key = (record.id, rec_type)
        if key in existing:
            return False
        recommendation = Recommendation(
            file_id=record.id,
            rec_type=rec_type,
            explanation=explanation,
            confidence=confidence,
            status=status,
        )
        session.add(recommendation)
        await session.flush()
        existing[key] = recommendation
        if operation is not None:
            operation.recommendation_id = recommendation.id
            session.add(operation)
        return True
