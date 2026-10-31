"""Response models for recommendations and extracted action items."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProposedOperationResponse(BaseModel):
    op_type: str
    source_path: str
    dest_path: str
    new_name: str | None


class RecommendationResponse(BaseModel):
    id: str
    file_id: str
    relative_path: str
    rec_type: str
    explanation: str
    confidence: str
    status: str
    created_at: datetime
    ranking_score: float
    proposed_operation: ProposedOperationResponse | None
    result_message: str | None = None


class ApprovalRequest(BaseModel):
    decision: Literal["approve", "reject"]
    user_note: str | None = Field(default=None, max_length=2000)


class BatchApprovalRequest(ApprovalRequest):
    recommendation_ids: list[str] = Field(min_length=1, max_length=100)


class RecommendationEditRequest(BaseModel):
    proposed: str = Field(min_length=1, max_length=1024)


class ActionStatusRequest(BaseModel):
    status: Literal["new", "verified", "done", "dismissed"]


class DuplicateStatusRequest(BaseModel):
    status: Literal["open", "dismissed"]


class ActionResponse(BaseModel):
    id: str
    file_id: str
    relative_path: str
    item_type: str
    description: str
    source_text: str
    date_hint: str | None
    date_verified: bool
    assignee_hint: str | None
    confidence: str
    extracted_at: datetime
    status: str
