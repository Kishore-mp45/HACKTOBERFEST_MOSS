"""Workspace-scoped recommendations and action-item endpoints."""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.database import session_dependency
from moss.models import (
    ActionItem,
    ActionItemReview,
    FileRecord,
    ProposedOperation,
    Recommendation,
    Workspace,
)
from moss.schemas.recommendation import (
    ActionResponse,
    ProposedOperationResponse,
    RecommendationResponse,
)
from moss.services.recommendation_service import recommendation_rank

router = APIRouter(prefix="/api")


async def _active_workspace(session: AsyncSession) -> Workspace | None:
    result = await session.execute(
        select(Workspace)
        .where(Workspace.status == "active")
        .order_by(Workspace.created_at)
    )
    return result.scalars().first()


async def _recommendation_response(
    session: AsyncSession,
    recommendation: Recommendation,
    record: FileRecord,
    workspace: Workspace,
) -> RecommendationResponse:
    operation_result = await session.execute(
        select(ProposedOperation).where(
            ProposedOperation.recommendation_id == recommendation.id
        )
    )
    operation = operation_result.scalar_one_or_none()
    proposed_operation = None
    if operation is not None:
        try:
            relative_destination = (
                Path(operation.dest_path)
                .resolve(strict=False)
                .relative_to(Path(workspace.root_path).resolve())
                .as_posix()
            )
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="A recommendation destination is outside the active workspace.",
            ) from error
        proposed_operation = ProposedOperationResponse(
            op_type=operation.op_type,
            source_path=record.relative_path,
            dest_path=relative_destination,
            new_name=operation.new_name,
        )
    return RecommendationResponse(
        id=recommendation.id,
        file_id=record.id,
        relative_path=record.relative_path,
        rec_type=recommendation.rec_type,
        explanation=recommendation.explanation,
        confidence=recommendation.confidence,
        status=recommendation.status,
        created_at=recommendation.created_at,
        ranking_score=recommendation_rank(
            recommendation.confidence,
            record.file_mtime,
        ),
        proposed_operation=proposed_operation,
    )


@router.get("/recommendations", response_model=list[RecommendationResponse])
async def get_recommendations(
    rec_type: str | None = Query(default=None, max_length=32),
    rec_status: str | None = Query(default=None, alias="status", max_length=32),
    session: AsyncSession = Depends(session_dependency),
) -> list[RecommendationResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        return []
    statement = (
        select(Recommendation, FileRecord)
        .join(FileRecord, Recommendation.file_id == FileRecord.id)
        .where(FileRecord.workspace_id == workspace.id)
    )
    if rec_type is not None:
        statement = statement.where(Recommendation.rec_type == rec_type)
    if rec_status is not None:
        statement = statement.where(Recommendation.status == rec_status)
    result = await session.execute(statement)
    responses = [
        await _recommendation_response(session, recommendation, record, workspace)
        for recommendation, record in result
    ]
    return sorted(
        responses,
        key=lambda item: (item.ranking_score, item.created_at),
        reverse=True,
    )


@router.get(
    "/recommendations/{recommendation_id}",
    response_model=RecommendationResponse,
)
async def get_recommendation(
    recommendation_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> RecommendationResponse:
    workspace = await _active_workspace(session)
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
    return await _recommendation_response(session, recommendation, record, workspace)


@router.get("/actions", response_model=list[ActionResponse])
async def get_actions(
    item_type: str | None = Query(default=None, alias="type", max_length=32),
    file_id: str | None = Query(default=None, max_length=36),
    session: AsyncSession = Depends(session_dependency),
) -> list[ActionResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        return []
    statement = (
        select(ActionItem, FileRecord)
        .join(FileRecord, ActionItem.file_id == FileRecord.id)
        .where(FileRecord.workspace_id == workspace.id)
    )
    if item_type is not None:
        statement = statement.where(ActionItem.item_type == item_type)
    if file_id is not None:
        statement = statement.where(ActionItem.file_id == file_id)
    result = await session.execute(statement.order_by(ActionItem.extracted_at.desc()))
    action_rows = list(result)
    review_result = await session.execute(
        select(ActionItemReview).where(
            ActionItemReview.action_item_id.in_(
                [action.id for action, _record in action_rows] or [""]
            )
        )
    )
    reviews = {review.action_item_id: review.status for review in review_result.scalars()}
    return [
        ActionResponse(
            id=action.id,
            file_id=record.id,
            relative_path=record.relative_path,
            item_type=action.item_type,
            description=action.description,
            source_text=action.source_text,
            date_hint=action.date_hint,
            date_verified=action.date_verified,
            assignee_hint=action.assignee_hint,
            confidence=action.confidence,
            extracted_at=action.extracted_at,
            status=reviews.get(action.id, "NEW"),
        )
        for action, record in action_rows
    ]
