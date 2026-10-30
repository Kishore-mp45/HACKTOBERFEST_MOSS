"""SQLAlchemy models for the Moss application."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    type_annotation_map = {dict[str, Any]: JSON}


class Workspace(Base):
    __tablename__ = "workspaces"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    root_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FileRecord(Base):
    __tablename__ = "file_records"
    __table_args__ = (UniqueConstraint("workspace_id", "relative_path"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    relative_path: Mapped[str] = mapped_column(Text, nullable=False)
    absolute_path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    file_mtime: Mapped[float | None] = mapped_column(Float)
    mime_type: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32), default="DISCOVERED", nullable=False)
    indexed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Extraction(Base):
    __tablename__ = "extractions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    full_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    word_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    page_chunks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    extraction_version: Mapped[str] = mapped_column(String(64), default="1", nullable=False)
    extracted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Classification(Base):
    __tablename__ = "classifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    purpose: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    language: Mapped[str] = mapped_column(String(16), nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)
    classified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Embedding(Base):
    __tablename__ = "embeddings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    vector_data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    dimensions: Mapped[int] = mapped_column(Integer, nullable=False)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class DocumentRelationship(Base):
    __tablename__ = "document_relationships"
    __table_args__ = (UniqueConstraint("file_a_id", "file_b_id", "relationship_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    file_a_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_b_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    similarity_score: Mapped[float] = mapped_column(Float, nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(32), nullable=False)
    cluster_id: Mapped[str | None] = mapped_column(String(36))


class DuplicateReview(Base):
    __tablename__ = "duplicate_reviews"

    relationship_id: Mapped[str] = mapped_column(
        ForeignKey("document_relationships.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="OPEN", nullable=False)


class CollectionReview(Base):
    __tablename__ = "collection_reviews"

    cluster_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ClusterGroup(Base):
    """LLM-refined naming for embedding-based semantic clusters."""

    __tablename__ = "cluster_groups"

    cluster_id: Mapped[str] = mapped_column(String(512), primary_key=True)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    @property
    def signature(self) -> str:
        return self.cluster_id


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    date_hint: Mapped[str | None] = mapped_column(String(255))
    date_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    assignee_hint: Mapped[str | None] = mapped_column(String(255))
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)
    extracted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ActionItemReview(Base):
    __tablename__ = "action_item_reviews"

    action_item_id: Mapped[str] = mapped_column(
        ForeignKey("action_items.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(32), default="NEW", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Recommendation(Base):
    __tablename__ = "recommendations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    file_id: Mapped[str] = mapped_column(
        ForeignKey("file_records.id", ondelete="CASCADE"), nullable=False, index=True
    )
    rec_type: Mapped[str] = mapped_column(String(32), nullable=False)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class ProposedOperation(Base):
    __tablename__ = "proposed_operations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    recommendation_id: Mapped[str] = mapped_column(
        ForeignKey("recommendations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    op_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_path: Mapped[str] = mapped_column(Text, nullable=False)
    dest_path: Mapped[str] = mapped_column(Text, nullable=False)
    new_name: Mapped[str | None] = mapped_column(String(255))


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    recommendation_id: Mapped[str] = mapped_column(
        ForeignKey("recommendations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    decision: Mapped[str] = mapped_column(String(32), nullable=False)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    user_note: Mapped[str | None] = mapped_column(Text)


class ExecutionRecord(Base):
    __tablename__ = "execution_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    proposed_op_id: Mapped[str] = mapped_column(
        ForeignKey("proposed_operations.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    original_path: Mapped[str] = mapped_column(Text, nullable=False)
    final_path: Mapped[str] = mapped_column(Text, nullable=False)
    content_hash: Mapped[str | None] = mapped_column(String(64))
    executed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    undone: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    workspace_id: Mapped[str] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True
    )
    job_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="QUEUED", nullable=False)
    total_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_files: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_log: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


__all__ = [
    "ActionItem",
    "ActionItemReview",
    "Approval",
    "Base",
    "Classification",
    "CollectionReview",
    "DocumentRelationship",
    "DuplicateReview",
    "Embedding",
    "ExecutionRecord",
    "Extraction",
    "FileRecord",
    "Job",
    "ProposedOperation",
    "Recommendation",
    "Workspace",
]
