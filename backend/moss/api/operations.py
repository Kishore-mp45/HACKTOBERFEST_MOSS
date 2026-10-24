"""Approved filesystem operations and their reversible history."""

from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.api.approvals import _active_workspace, _recommendation
from moss.api.recommendations import _recommendation_response
from moss.database import session_dependency
from moss.filesystem import safe_move, safe_rename, sha256_file, undo_move
from moss.models import (
    Approval,
    CollectionReview,
    DocumentRelationship,
    ExecutionRecord,
    FileRecord,
    ProposedOperation,
    Recommendation,
    Workspace,
)
from moss.schemas.dashboard import ActivityResponse
from moss.schemas.recommendation import RecommendationResponse
from moss.security.path_guard import PathGuard, SecurityError

router = APIRouter(prefix="/api")


def _operation_kind(operation: ProposedOperation) -> str:
    return "rename" if operation.op_type.upper() == "RENAME" else "move"


def _relative_path(workspace: Workspace, path: str) -> str:
    try:
        return Path(path).resolve(strict=False).relative_to(
            Path(workspace.root_path).resolve()
        ).as_posix()
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An operation record points outside the active workspace.",
        ) from error


async def _execution_context(
    session: AsyncSession,
    workspace: Workspace | None,
    execution_id: str,
) -> tuple[ExecutionRecord, ProposedOperation, Recommendation, FileRecord]:
    if workspace is None:
        raise HTTPException(status_code=404, detail="No active workspace is configured.")
    result = await session.execute(
        select(ExecutionRecord, ProposedOperation, Recommendation, FileRecord)
        .join(
            ProposedOperation,
            ProposedOperation.id == ExecutionRecord.proposed_op_id,
        )
        .join(
            Recommendation,
            Recommendation.id == ProposedOperation.recommendation_id,
        )
        .join(FileRecord, FileRecord.id == Recommendation.file_id)
        .where(
            ExecutionRecord.id == execution_id,
            FileRecord.workspace_id == workspace.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Operation not found in the active workspace.",
        )
    return row[0], row[1], row[2], row[3]


def _activity_response(
    execution: ExecutionRecord,
    operation: ProposedOperation,
    record: FileRecord,
    workspace: Workspace,
) -> ActivityResponse:
    kind = _operation_kind(operation)
    original = _relative_path(workspace, execution.original_path)
    final = _relative_path(workspace, execution.final_path)
    successful = execution.status in {"SUCCEEDED", "UNDONE"}
    return ActivityResponse(
        id=execution.id,
        kind=kind,
        title=f"{'Renamed' if kind == 'rename' else 'Moved'} '{original}'",
        detail=(
            f"Restored to {original}."
            if execution.undone
            else f"Destination: {final}."
        ),
        created_at=execution.executed_at,
        undoable=execution.status == "SUCCEEDED" and not execution.undone,
        outcome="success" if successful else "failure",
        related_file_ids=[record.id],
        undone=execution.undone,
        operation_id=execution.id,
    )


@router.post(
    "/recommendations/{recommendation_id}/execute",
    response_model=RecommendationResponse,
)
async def execute_recommendation(
    recommendation_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> RecommendationResponse:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(status_code=404, detail="No active workspace is configured.")
    recommendation, record, operation = await _recommendation(
        session, workspace, recommendation_id
    )
    if recommendation.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Approve this recommendation before execution.",
        )
    approval_result = await session.execute(
        select(Approval).where(
            Approval.recommendation_id == recommendation.id,
            Approval.decision == "APPROVE",
        )
    )
    if approval_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An approval record is required before execution.",
        )
    if operation is None:
        if recommendation.rec_type == "group_tag":
            cluster_result = await session.execute(
                select(DocumentRelationship.cluster_id)
                .where(
                    DocumentRelationship.cluster_id.is_not(None),
                    (
                        (DocumentRelationship.file_a_id == record.id)
                        | (DocumentRelationship.file_b_id == record.id)
                    ),
                )
                .limit(1)
            )
            cluster_id = cluster_result.scalar_one_or_none()
            if cluster_id is not None:
                review = await session.get(CollectionReview, cluster_id)
                if review is None:
                    session.add(
                        CollectionReview(
                            cluster_id=cluster_id,
                            workspace_id=workspace.id,
                            status="CONFIRMED",
                        )
                    )
                else:
                    review.status = "CONFIRMED"
                    review.decided_at = datetime.now(UTC)
        recommendation.status = "APPLIED"
        await session.commit()
        await session.refresh(recommendation)
        response = await _recommendation_response(
            session, recommendation, record, workspace
        )
        return response.model_copy(
            update={
                "result_message": (
                    "The reviewed suggestion was recorded; no files were changed."
                )
            }
        )

    if operation.op_type.upper() not in {"MOVE", "RENAME"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This operation type cannot be executed by the filesystem engine.",
        )

    try:
        guard = PathGuard(workspace.root_path)
        source = guard.validate(operation.source_path)
        tracked_source = guard.validate(record.absolute_path)
        destination = guard.validate(operation.dest_path)
    except (OSError, RuntimeError, SecurityError) as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Source and destination must remain inside the active workspace.",
        ) from error
    if source != tracked_source:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The recommendation source no longer matches the tracked workspace file.",
        )
    if operation.op_type.upper() == "RENAME" and destination.parent != source.parent:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A rename recommendation cannot move the file to another folder.",
        )

    execution_result = await session.execute(
        select(ExecutionRecord).where(
            ExecutionRecord.proposed_op_id == operation.id
        )
    )
    execution = execution_result.scalar_one_or_none()
    if execution is not None and execution.status in {"RUNNING", "SUCCEEDED", "UNDONE"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This operation has already been started or completed.",
        )
    try:
        content_hash = sha256_file(source) if source.is_file() else None
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The source file could not be read safely before execution.",
        ) from error
    if execution is None:
        execution = ExecutionRecord(
            proposed_op_id=operation.id,
            status="RUNNING",
            original_path=str(source),
            final_path=str(destination),
            content_hash=content_hash,
        )
        session.add(execution)
    else:
        execution.status = "RUNNING"
        execution.original_path = str(source)
        execution.final_path = str(destination)
        execution.content_hash = content_hash
        execution.undone = False
        execution.executed_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(execution)

    try:
        moved = (
            safe_rename(source, destination.name, guard)
            if operation.op_type.upper() == "RENAME"
            else safe_move(source, destination, guard)
        )
    except (OSError, RuntimeError, ValueError, SecurityError) as error:
        execution.status = "FAILED"
        recommendation.status = "FAILED"
        await session.commit()
        if isinstance(error, FileNotFoundError):
            detail = "The source file is missing. Nothing was moved."
        elif isinstance(error, SecurityError):
            detail = "Source and destination must remain inside the active workspace."
        elif isinstance(error, ValueError):
            detail = "The source and destination do not describe a valid file operation."
        else:
            detail = "The filesystem operation failed. Check file permissions and try again."
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        ) from error

    execution.final_path = str(moved.final)
    execution.status = "SUCCEEDED"
    operation.dest_path = str(moved.final)
    record.absolute_path = str(moved.final)
    record.relative_path = moved.final.relative_to(guard.root).as_posix()
    stat = moved.final.stat()
    record.file_size_bytes = stat.st_size
    record.file_mtime = stat.st_mtime
    recommendation.status = "APPLIED"
    await session.commit()
    await session.refresh(recommendation)
    response = await _recommendation_response(
        session, recommendation, record, workspace
    )
    return response.model_copy(
        update={
            "result_message": (
                f"{'Renamed to' if operation.op_type.upper() == 'RENAME' else 'Moved to'} "
                f"{record.relative_path}; the operation can be undone from Activity."
            )
        }
    )


@router.post(
    "/operations/{execution_id}/undo",
    response_model=ActivityResponse,
)
async def undo_operation(
    execution_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> ActivityResponse:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(status_code=404, detail="No active workspace is configured.")
    execution, operation, _, record = await _execution_context(
        session, workspace, execution_id
    )
    if execution.undone or execution.status == "UNDONE":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This operation has already been undone.",
        )
    if execution.status != "SUCCEEDED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only successfully completed operations can be undone.",
        )
    try:
        guard = PathGuard(workspace.root_path)
        original = guard.validate(execution.original_path)
        final = guard.validate(execution.final_path)
        restored = undo_move(
            original,
            final,
            guard,
            expected_hash=execution.content_hash,
        )
    except FileExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Undo stopped because the original path is occupied. Move the "
                "current file elsewhere and try again."
            ),
        ) from error
    except FileNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Undo stopped because the moved file is missing. It may have "
                "been deleted or moved outside Moss."
            ),
        ) from error
    except (OSError, RuntimeError, SecurityError) as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Undo could not validate both paths inside the active workspace.",
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Undo stopped because the moved file changed after execution.",
        ) from error

    execution.status = "UNDONE"
    execution.undone = True
    record.absolute_path = str(restored.final)
    record.relative_path = restored.final.relative_to(guard.root).as_posix()
    stat = restored.final.stat()
    record.file_size_bytes = stat.st_size
    record.file_mtime = stat.st_mtime
    await session.commit()
    await session.refresh(execution)
    return _activity_response(execution, operation, record, workspace)
