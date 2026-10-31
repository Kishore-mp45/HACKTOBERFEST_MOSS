"""Human review and approval endpoints."""

from datetime import UTC, datetime
from pathlib import Path, PureWindowsPath
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.api.recommendations import _recommendation_response
from moss.database import session_dependency
from moss.models import (
    ActionItem,
    ActionItemReview,
    Approval,
    CollectionReview,
    DocumentRelationship,
    DuplicateReview,
    FileRecord,
    ProposedOperation,
    Recommendation,
    Workspace,
)
from moss.schemas.recommendation import (
    ActionStatusRequest,
    ApprovalRequest,
    BatchApprovalRequest,
    DuplicateStatusRequest,
    RecommendationEditRequest,
    RecommendationResponse,
)
from moss.security.path_guard import PathGuard, SecurityError
from moss.services.recommendation_service import sanitize_filename

router = APIRouter(prefix="/api")


async def _active_workspace(session: AsyncSession) -> Workspace | None:
    result = await session.execute(
        select(Workspace)
        .where(Workspace.status == "active")
        .order_by(Workspace.created_at)
    )
    return result.scalars().first()


async def _recommendation(
    session: AsyncSession,
    workspace: Workspace | None,
    recommendation_id: str,
) -> tuple[Recommendation, FileRecord, ProposedOperation | None]:
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace is configured.",
        )
    result = await session.execute(
        select(Recommendation, FileRecord)
        .join(FileRecord, Recommendation.file_id == FileRecord.id)
        .where(
            Recommendation.id == recommendation_id,
            FileRecord.workspace_id == workspace.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recommendation not found in the active workspace.",
        )
    recommendation, record = row
    operation_result = await session.execute(
        select(ProposedOperation).where(
            ProposedOperation.recommendation_id == recommendation.id
        )
    )
    return recommendation, record, operation_result.scalar_one_or_none()


async def _record_decision(
    session: AsyncSession,
    recommendation: Recommendation,
    decision: Literal["approve", "reject"],
    user_note: str | None,
) -> None:
    recommendation.status = "APPROVED" if decision == "approve" else "REJECTED"
    result = await session.execute(
        select(Approval).where(Approval.recommendation_id == recommendation.id)
    )
    approval = result.scalar_one_or_none()
    if approval is None:
        approval = Approval(
            recommendation_id=recommendation.id,
            decision=decision.upper(),
            user_note=user_note,
        )
        session.add(approval)
    else:
        approval.decision = decision.upper()
        approval.user_note = user_note
        approval.decided_at = datetime.now(UTC)


@router.post(
    "/approvals/batch",
    response_model=list[RecommendationResponse],
)
async def decide_recommendations_batch(
    payload: BatchApprovalRequest,
    session: AsyncSession = Depends(session_dependency),
) -> list[RecommendationResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace is configured.",
        )
    ids = list(dict.fromkeys(payload.recommendation_ids))
    result = await session.execute(
        select(Recommendation, FileRecord)
        .join(FileRecord, Recommendation.file_id == FileRecord.id)
        .where(
            Recommendation.id.in_(ids),
            FileRecord.workspace_id == workspace.id,
        )
    )
    rows = list(result)
    if len(rows) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more recommendations were not found in the active workspace.",
        )
    if any(recommendation.status != "PENDING" for recommendation, _ in rows):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Batch decisions only accept pending recommendations.",
        )
    if payload.decision == "approve":
        try:
            guard = PathGuard(workspace.root_path)
            file_by_recommendation = {
                recommendation.id: record for recommendation, record in rows
            }
            operation_result = await session.execute(
                select(ProposedOperation).where(
                    ProposedOperation.recommendation_id.in_(ids)
                )
            )
            for operation in operation_result.scalars():
                source = guard.validate(operation.source_path)
                tracked_source = guard.validate(
                    file_by_recommendation[operation.recommendation_id].absolute_path
                )
                guard.validate(operation.dest_path)
                if source != tracked_source:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=(
                            "A recommendation source no longer matches its "
                            "tracked workspace file."
                        ),
                    )
        except (OSError, RuntimeError, SecurityError) as error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Source and destination must remain inside the active workspace.",
            ) from error
    for recommendation, _ in rows:
        await _record_decision(
            session,
            recommendation,
            payload.decision,
            payload.user_note,
        )
    await session.commit()
    responses = []
    for recommendation, record in rows:
        await session.refresh(recommendation)
        responses.append(
            await _recommendation_response(session, recommendation, record, workspace)
        )
    return responses


@router.post(
    "/approvals/{recommendation_id}",
    response_model=RecommendationResponse,
)
async def decide_recommendation(
    recommendation_id: str,
    payload: ApprovalRequest,
    session: AsyncSession = Depends(session_dependency),
) -> RecommendationResponse:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace is configured.",
        )
    recommendation, record, operation = await _recommendation(
        session, workspace, recommendation_id
    )
    if recommendation.status not in {"PENDING", "APPROVED"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This recommendation is already {recommendation.status.lower()}.",
        )
    if payload.decision == "approve" and operation is not None:
        try:
            guard = PathGuard(workspace.root_path)
            source = guard.validate(operation.source_path)
            tracked_source = guard.validate(record.absolute_path)
            guard.validate(operation.dest_path)
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
    await _record_decision(session, recommendation, payload.decision, payload.user_note)
    await session.commit()
    await session.refresh(recommendation)
    return await _recommendation_response(session, recommendation, record, workspace)


@router.post(
    "/recommendations/{recommendation_id}/edit",
    response_model=RecommendationResponse,
)
async def edit_recommendation(
    recommendation_id: str,
    payload: RecommendationEditRequest,
    session: AsyncSession = Depends(session_dependency),
) -> RecommendationResponse:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace is configured.",
        )
    recommendation, record, operation = await _recommendation(
        session, workspace, recommendation_id
    )
    if recommendation.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only pending recommendations can be edited.",
        )
    if operation is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This recommendation has no editable file operation.",
        )

    proposed = payload.proposed.strip()
    source = Path(operation.source_path)
    if operation.op_type.upper() == "RENAME":
        windows_path = PureWindowsPath(proposed)
        if (
            Path(proposed).name != proposed
            or windows_path.name != proposed
            or proposed in {".", ".."}
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="A rename proposal must be a filename, not a path.",
            )
        safe_name = sanitize_filename(proposed)
        if safe_name != proposed or Path(safe_name).suffix.casefold() != source.suffix.casefold():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="The new filename must be safe and keep the existing file extension.",
            )
        operation.new_name = safe_name
        operation.dest_path = str(source.with_name(safe_name))
    elif operation.op_type.upper() == "MOVE":
        folder = proposed.rstrip("/\\")
        windows_folder = PureWindowsPath(folder)
        if not folder or windows_folder.is_absolute() or windows_folder.drive:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Choose a workspace-relative destination folder.",
            )
        try:
            guard = PathGuard(workspace.root_path)
            destination_folder = guard.validate(Path(folder))
            if any(part == ".." for part in Path(folder).parts):
                raise SecurityError("Parent traversal is not permitted.")
            operation.dest_path = str(destination_folder / source.name)
        except (OSError, RuntimeError, SecurityError) as error:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Destination folder must remain inside the active workspace.",
            ) from error
        operation.new_name = None
    else:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This operation type cannot be edited.",
        )

    await session.commit()
    await session.refresh(recommendation)
    return await _recommendation_response(session, recommendation, record, workspace)


@router.post("/collections/{cluster_id}/confirm")
async def confirm_collection(
    cluster_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> dict[str, str]:
    return await _review_collection(cluster_id, "CONFIRMED", session)


@router.post("/collections/{cluster_id}/dismiss")
async def dismiss_collection(
    cluster_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> dict[str, str]:
    return await _review_collection(cluster_id, "DISMISSED", session)


async def _review_collection(
    cluster_id: str,
    decision: Literal["CONFIRMED", "DISMISSED"],
    session: AsyncSession,
) -> dict[str, str]:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(status_code=404, detail="No active workspace is configured.")
    result = await session.execute(
        select(DocumentRelationship.id)
        .join(FileRecord, FileRecord.id == DocumentRelationship.file_a_id)
        .where(
            DocumentRelationship.cluster_id == cluster_id,
            FileRecord.workspace_id == workspace.id,
        )
        .limit(1)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Collection not found in the active workspace.")
    review = await session.get(CollectionReview, cluster_id)
    if review is None:
        review = CollectionReview(
            cluster_id=cluster_id,
            workspace_id=workspace.id,
            status=decision,
        )
        session.add(review)
    else:
        review.status = decision
        review.decided_at = datetime.now(UTC)
    await session.commit()
    return {"id": cluster_id, "status": decision}


@router.post("/actions/{action_id}/status")
async def update_action_status(
    action_id: str,
    payload: ActionStatusRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict[str, str]:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(status_code=404, detail="No active workspace is configured.")
    action_result = await session.execute(
        select(ActionItem)
        .join(FileRecord, FileRecord.id == ActionItem.file_id)
        .where(ActionItem.id == action_id, FileRecord.workspace_id == workspace.id)
    )
    action = action_result.scalar_one_or_none()
    if action is None:
        raise HTTPException(
            status_code=404,
            detail="Action item not found in the active workspace.",
        )
    requested = payload.status.upper()
    review = await session.get(ActionItemReview, action_id)
    if review is None:
        session.add(ActionItemReview(action_item_id=action_id, status=requested))
    else:
        review.status = requested
        review.updated_at = datetime.now(UTC)
    await session.commit()
    return {"id": action_id, "status": requested}


@router.post("/duplicates/{relationship_id}/status")
async def update_duplicate_status(
    relationship_id: str,
    payload: DuplicateStatusRequest,
    session: AsyncSession = Depends(session_dependency),
) -> dict[str, str]:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(status_code=404, detail="No active workspace is configured.")
    result = await session.execute(
        select(DocumentRelationship)
        .join(FileRecord, FileRecord.id == DocumentRelationship.file_a_id)
        .where(
            DocumentRelationship.id == relationship_id,
            FileRecord.workspace_id == workspace.id,
            DocumentRelationship.relationship_type.in_(
                ["EXACT_DUPLICATE", "NEAR_DUPLICATE"]
            ),
        )
    )
    relationship = result.scalar_one_or_none()
    if relationship is None:
        raise HTTPException(
            status_code=404,
            detail="Duplicate candidate not found in the active workspace.",
        )
    requested = payload.status.upper()
    review = await session.get(DuplicateReview, relationship_id)
    if review is None:
        session.add(DuplicateReview(relationship_id=relationship_id, status=requested))
    else:
        review.status = requested
    await session.commit()
    return {"id": relationship_id, "status": requested}
