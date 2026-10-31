"""File relationship and duplicate discovery endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.database import session_dependency
from moss.models import DocumentRelationship, DuplicateReview, FileRecord, Workspace
from moss.schemas.relationship import DuplicateResponse, FileRelationshipResponse

router = APIRouter(prefix="/api")


async def _active_workspace(session: AsyncSession) -> Workspace | None:
    result = await session.execute(
        select(Workspace)
        .where(Workspace.status == "active")
        .order_by(Workspace.created_at)
    )
    return result.scalars().first()


@router.get(
    "/files/{file_id}/relationships",
    response_model=list[FileRelationshipResponse],
)
async def get_file_relationships(
    file_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> list[FileRelationshipResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active workspace is configured.",
        )
    file_result = await session.execute(
        select(FileRecord.id).where(
            FileRecord.id == file_id,
            FileRecord.workspace_id == workspace.id,
        )
    )
    if file_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found in the active workspace.",
        )

    relationship_result = await session.execute(
        select(DocumentRelationship, FileRecord)
        .join(
            FileRecord,
            or_(
                and_(
                    DocumentRelationship.file_a_id == file_id,
                    FileRecord.id == DocumentRelationship.file_b_id,
                ),
                and_(
                    DocumentRelationship.file_b_id == file_id,
                    FileRecord.id == DocumentRelationship.file_a_id,
                ),
            ),
        )
        .where(
            or_(
                DocumentRelationship.file_a_id == file_id,
                DocumentRelationship.file_b_id == file_id,
            ),
            FileRecord.workspace_id == workspace.id,
        )
        .order_by(DocumentRelationship.relationship_type, FileRecord.relative_path)
    )
    return [
        FileRelationshipResponse(
            file_id=related_file.id,
            relative_path=related_file.relative_path,
            relationship_type=relationship.relationship_type,
            similarity_score=relationship.similarity_score,
            cluster_id=relationship.cluster_id,
        )
        for relationship, related_file in relationship_result
    ]


@router.get("/duplicates", response_model=list[DuplicateResponse])
async def get_duplicates(
    session: AsyncSession = Depends(session_dependency),
) -> list[DuplicateResponse]:
    workspace = await _active_workspace(session)
    if workspace is None:
        return []

    left_file = FileRecord.__table__.alias("left_file")
    right_file = FileRecord.__table__.alias("right_file")
    result = await session.execute(
        select(
            DocumentRelationship,
            left_file.c.id,
            left_file.c.relative_path,
            right_file.c.id,
            right_file.c.relative_path,
            DuplicateReview.status,
        )
        .join(left_file, DocumentRelationship.file_a_id == left_file.c.id)
        .join(right_file, DocumentRelationship.file_b_id == right_file.c.id)
        .outerjoin(
            DuplicateReview,
            DuplicateReview.relationship_id == DocumentRelationship.id,
        )
        .where(
            left_file.c.workspace_id == workspace.id,
            right_file.c.workspace_id == workspace.id,
            DocumentRelationship.relationship_type.in_(
                ["EXACT_DUPLICATE", "NEAR_DUPLICATE"]
            ),
        )
        .order_by(left_file.c.relative_path, right_file.c.relative_path)
    )
    return [
        DuplicateResponse(
            id=relationship.id,
            file_a_id=file_a_id,
            file_a_path=file_a_path,
            file_b_id=file_b_id,
            file_b_path=file_b_path,
            duplicate_type=relationship.relationship_type,
            similarity_score=relationship.similarity_score,
            status=review_status or "OPEN",
        )
        for (
            relationship,
            file_a_id,
            file_a_path,
            file_b_id,
            file_b_path,
            review_status,
        ) in result
    ]
