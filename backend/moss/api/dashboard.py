"""Read-only dashboard endpoints consumed by the frontend."""

from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.database import session_dependency
from moss.models import (
    ActionItem,
    Approval,
    Classification,
    CollectionReview,
    DocumentRelationship,
    ExecutionRecord,
    FileRecord,
    Job,
    ProposedOperation,
    Recommendation,
    Workspace,
)
from moss.schemas.dashboard import (
    ActivityResponse,
    AttentionResponse,
    CollectionResponse,
    OverviewResponse,
    OverviewStatsResponse,
    RelationshipSummaryResponse,
    WorkspaceFileResponse,
)

router = APIRouter(prefix="/api")

_KIND_BY_SUFFIX = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".md": "md",
    ".markdown": "md",
    ".txt": "txt",
    ".xlsx": "xlsx",
    ".csv": "csv",
}
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff", ".bmp", ".webp"}


async def _active_workspace(session: AsyncSession) -> Workspace | None:
    result = await session.execute(
        select(Workspace)
        .where(Workspace.status == "active")
        .order_by(Workspace.created_at)
    )
    return result.scalars().first()


def _file_response(
    record: FileRecord,
    classification: Classification | None,
) -> WorkspaceFileResponse:
    path = Path(record.relative_path)
    suffix = path.suffix.casefold()
    kind = _KIND_BY_SUFFIX.get(suffix, "image" if suffix in _IMAGE_SUFFIXES else "txt")
    modified_at = (
        datetime.fromtimestamp(record.file_mtime, UTC)
        if record.file_mtime is not None
        else record.indexed_at
    )
    has_error = record.status.endswith("_FAILED") or record.status in {
        "ERROR",
        "FAILED",
        "EXTRACTED_WITH_ERRORS",
        "SKIPPED_TOO_LARGE",
    }
    return WorkspaceFileResponse(
        id=record.id,
        name=path.name,
        path=record.relative_path,
        kind=kind,
        size_bytes=record.file_size_bytes,
        modified_at=modified_at,
        status=(
            "analyzed"
            if record.status == "ANALYZED"
            else "error"
            if has_error
            else "pending"
        ),
        category=classification.topic if classification else None,
        summary=classification.summary if classification else None,
        topics=[classification.topic] if classification else [],
        keywords=classification.keywords if classification else [],
        error_message=record.status.replace("_", " ").lower() if has_error else None,
    )


async def _workspace_files(
    session: AsyncSession,
    workspace: Workspace,
) -> list[WorkspaceFileResponse]:
    result = await session.execute(
        select(FileRecord, Classification)
        .outerjoin(Classification, Classification.file_id == FileRecord.id)
        .where(FileRecord.workspace_id == workspace.id)
        .order_by(FileRecord.relative_path)
    )
    return [_file_response(record, classification) for record, classification in result]


def _job_activity(job: Job) -> ActivityResponse:
    finished = job.finished_at or job.started_at or datetime.now(UTC)
    is_failed = job.status == "FAILED"
    has_errors = job.status == "COMPLETED_WITH_ERRORS"
    return ActivityResponse(
        id=job.id,
        kind="error" if is_failed else "scan",
        title="Workspace scan failed" if is_failed else "Workspace scan",
        detail=(
            "; ".join(
                str(item.get("error", "File processing error"))
                for item in job.error_log
            )
            if is_failed and job.error_log
            else (
                f"Processed {job.processed_files} of {job.total_files} files"
                + (" with errors." if has_errors else ".")
            )
        ),
        created_at=finished,
        undoable=False,
        outcome="failure" if is_failed else "partial" if has_errors else "success",
        related_file_ids=[],
    )


@router.get("/files", response_model=list[WorkspaceFileResponse])
async def list_files(
    session: AsyncSession = Depends(session_dependency),
) -> list[WorkspaceFileResponse]:
    workspace = await _active_workspace(session)
    return await _workspace_files(session, workspace) if workspace else []


@router.get("/files/{file_id}", response_model=WorkspaceFileResponse)
async def get_file(
    file_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> WorkspaceFileResponse:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace is configured.",
        )
    result = await session.execute(
        select(FileRecord, Classification)
        .outerjoin(Classification, Classification.file_id == FileRecord.id)
        .where(FileRecord.id == file_id, FileRecord.workspace_id == workspace.id)
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in the active workspace.",
        )
    record, classification = row
    return _file_response(record, classification)


@router.get("/collections", response_model=list[CollectionResponse])
async def list_collections(
    session: AsyncSession = Depends(session_dependency),
) -> list[CollectionResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        return []

    file_result = await session.execute(
        select(FileRecord, Classification)
        .outerjoin(Classification, Classification.file_id == FileRecord.id)
        .where(FileRecord.workspace_id == workspace.id)
    )
    files = {record.id: (record, classification) for record, classification in file_result}
    relationship_result = await session.execute(
        select(DocumentRelationship).where(
            DocumentRelationship.cluster_id.is_not(None),
            DocumentRelationship.file_a_id.in_(files or [""]),
            DocumentRelationship.file_b_id.in_(files or [""]),
        )
    )
    members: dict[str, set[str]] = defaultdict(set)
    for relationship in relationship_result.scalars():
        if relationship.cluster_id:
            members[relationship.cluster_id].update(
                (relationship.file_a_id, relationship.file_b_id)
            )

    collections: list[CollectionResponse] = []
    for cluster_id, file_ids in sorted(members.items()):
        valid_ids = sorted(file_id for file_id in file_ids if file_id in files)
        if len(valid_ids) < 2:
            continue
        review = await session.get(CollectionReview, cluster_id)
        if review is not None and review.workspace_id != workspace.id:
            review = None
        if review is not None and review.status == "DISMISSED":
            continue
        classifications = [
            files[file_id][1]
            for file_id in valid_ids
            if files[file_id][1] is not None
        ]
        topic = classifications[0].topic if classifications else "Related documents"
        keywords = sorted(
            {
                keyword
                for classification in classifications
                for keyword in classification.keywords
            }
        )
        collections.append(
            CollectionResponse(
                id=cluster_id,
                name=topic,
                description=f"Documents grouped around {topic}.",
                keywords=keywords,
                file_ids=valid_ids,
                origin="confirmed" if review and review.status == "CONFIRMED" else "ai",
                created_at=workspace.last_scanned_at or workspace.created_at,
                evidence=[],
            )
        )
    return collections


@router.get("/activity", response_model=list[ActivityResponse])
async def list_activity(
    session: AsyncSession = Depends(session_dependency),
) -> list[ActivityResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        return []
    job_result = await session.execute(
        select(Job)
        .where(Job.workspace_id == workspace.id)
    )
    events = [_job_activity(job) for job in job_result.scalars()]
    execution_result = await session.execute(
        select(ExecutionRecord, ProposedOperation, Recommendation, FileRecord)
        .join(ProposedOperation, ProposedOperation.id == ExecutionRecord.proposed_op_id)
        .join(Recommendation, Recommendation.id == ProposedOperation.recommendation_id)
        .join(FileRecord, FileRecord.id == Recommendation.file_id)
        .where(FileRecord.workspace_id == workspace.id)
    )
    for execution, operation, _, record in execution_result:
        kind = "rename" if operation.op_type.upper() == "RENAME" else "move"
        original = Path(execution.original_path).resolve(strict=False).relative_to(
            Path(workspace.root_path).resolve()
        ).as_posix()
        final = Path(execution.final_path).resolve(strict=False).relative_to(
            Path(workspace.root_path).resolve()
        ).as_posix()
        succeeded = execution.status in {"SUCCEEDED", "UNDONE"}
        events.append(
            ActivityResponse(
                id=execution.id,
                kind=kind if succeeded else "error",
                title=f"{'Renamed' if kind == 'rename' else 'Moved'} '{original}'",
                detail=(
                    f"Restored to {original}."
                    if execution.undone
                    else f"Destination: {final}."
                    if succeeded
                    else "The operation failed before completion."
                ),
                created_at=execution.executed_at,
                undoable=execution.status == "SUCCEEDED" and not execution.undone,
                outcome="success" if succeeded else "failure",
                related_file_ids=[record.id],
                undone=execution.undone,
                operation_id=execution.id,
            )
        )
    approval_result = await session.execute(
        select(Approval, Recommendation, FileRecord)
        .join(Recommendation, Recommendation.id == Approval.recommendation_id)
        .join(FileRecord, FileRecord.id == Recommendation.file_id)
        .where(FileRecord.workspace_id == workspace.id)
    )
    events.extend(
        ActivityResponse(
            id=f"approval-{approval.id}",
            kind="approval" if approval.decision == "APPROVE" else "dismissal",
            title=(
                f"Approved: {recommendation.rec_type.replace('_', ' ')} suggestion"
                if approval.decision == "APPROVE"
                else f"Rejected: {recommendation.rec_type.replace('_', ' ')} suggestion"
            ),
            detail=approval.user_note or recommendation.explanation,
            created_at=approval.decided_at,
            undoable=False,
            outcome="success",
            related_file_ids=[record.id],
        )
        for approval, recommendation, record in approval_result
    )
    events.sort(key=lambda event: event.created_at, reverse=True)
    return events[:100]


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    session: AsyncSession = Depends(session_dependency),
) -> OverviewResponse:
    workspace = await _active_workspace(session)
    if workspace is None:
        return OverviewResponse(
            stats=OverviewStatsResponse(
                files_analyzed=0,
                files_pending=0,
                semantic_groups=0,
                duplicate_candidates=0,
                action_items=0,
                pending_recommendations=0,
                last_analyzed_at=None,
            ),
            attention=[],
            recent_relationships=[],
            recent_activity=[],
        )

    files = await _workspace_files(session, workspace)
    collections = await list_collections(session)
    duplicate_result = await session.execute(
        select(DocumentRelationship.id)
        .join(FileRecord, FileRecord.id == DocumentRelationship.file_a_id)
        .where(
            FileRecord.workspace_id == workspace.id,
            DocumentRelationship.relationship_type.in_(
                ["EXACT_DUPLICATE", "NEAR_DUPLICATE"]
            ),
        )
    )
    action_result = await session.execute(
        select(ActionItem.id)
        .join(FileRecord, FileRecord.id == ActionItem.file_id)
        .where(FileRecord.workspace_id == workspace.id)
    )
    recommendation_result = await session.execute(
        select(Recommendation.id).where(
            Recommendation.status == "PENDING",
            Recommendation.file_id.in_(
                select(FileRecord.id).where(FileRecord.workspace_id == workspace.id)
            ),
        )
    )
    jobs = (await list_activity(session))[:4]
    error_files = [file for file in files if file.status == "error"]
    file_ids = [file.id for file in files]
    relationship_result = await session.execute(
        select(DocumentRelationship)
        .where(
            DocumentRelationship.file_a_id.in_(file_ids or [""]),
            DocumentRelationship.file_b_id.in_(file_ids or [""]),
        )
        .order_by(DocumentRelationship.similarity_score.desc())
        .limit(4)
    )
    recent_relationships = [
        RelationshipSummaryResponse(
            id=relationship.id,
            source_file_id=relationship.file_a_id,
            target_file_id=relationship.file_b_id,
            similarity=relationship.similarity_score,
            rationale=relationship.relationship_type.replace("_", " ").lower(),
        )
        for relationship in relationship_result.scalars()
    ]

    return OverviewResponse(
        stats=OverviewStatsResponse(
            files_analyzed=sum(file.status == "analyzed" for file in files),
            files_pending=sum(file.status == "pending" for file in files),
            semantic_groups=len(collections),
            duplicate_candidates=len(list(duplicate_result.scalars())),
            action_items=len(list(action_result.scalars())),
            pending_recommendations=len(list(recommendation_result.scalars())),
            last_analyzed_at=workspace.last_scanned_at,
        ),
        attention=[
            AttentionResponse(
                file_id=file.id,
                file_name=file.name,
                reason=file.error_message or "This file could not be analyzed.",
                severity="error",
            )
            for file in error_files
        ],
        recent_relationships=recent_relationships,
        recent_activity=jobs,
    )
