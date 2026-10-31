"""Read-only dashboard response models."""

from datetime import datetime

from pydantic import BaseModel


class WorkspaceFileResponse(BaseModel):
    id: str
    name: str
    path: str
    kind: str
    size_bytes: int
    modified_at: datetime | None
    status: str
    category: str | None
    summary: str | None
    topics: list[str]
    keywords: list[str]
    suggested_name: str | None = None
    suggested_folder: str | None = None
    ocr_used: bool = False
    error_message: str | None = None


class CollectionResponse(BaseModel):
    id: str
    name: str
    description: str
    keywords: list[str]
    file_ids: list[str]
    origin: str
    created_at: datetime
    evidence: list[dict[str, str]]


class ActivityResponse(BaseModel):
    id: str
    kind: str
    title: str
    detail: str
    created_at: datetime
    undoable: bool
    outcome: str
    related_file_ids: list[str]
    undone: bool = False
    operation_id: str | None = None


class OverviewStatsResponse(BaseModel):
    files_analyzed: int
    files_pending: int
    semantic_groups: int
    duplicate_candidates: int
    action_items: int
    pending_recommendations: int
    last_analyzed_at: datetime | None


class AttentionResponse(BaseModel):
    file_id: str
    file_name: str
    reason: str
    severity: str


class RelationshipSummaryResponse(BaseModel):
    id: str
    source_file_id: str
    target_file_id: str
    similarity: float
    rationale: str


class OverviewResponse(BaseModel):
    stats: OverviewStatsResponse
    attention: list[AttentionResponse]
    recent_relationships: list[RelationshipSummaryResponse]
    recent_activity: list[ActivityResponse]
