"""API response models for document relationships and duplicate candidates."""

from pydantic import BaseModel


class FileRelationshipResponse(BaseModel):
    file_id: str
    relative_path: str
    relationship_type: str
    similarity_score: float
    cluster_id: str | None


class DuplicateResponse(BaseModel):
    id: str
    file_a_id: str
    file_a_path: str
    file_b_id: str
    file_b_path: str
    duplicate_type: str
    similarity_score: float
    status: str
