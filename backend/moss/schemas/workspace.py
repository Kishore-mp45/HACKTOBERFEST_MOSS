"""Workspace API request and response models."""

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceConfigureRequest(BaseModel):
    path: str = Field(min_length=1, max_length=32768)
    name: str | None = Field(default=None, min_length=1, max_length=255)


class WorkspaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    root_path: str
    status: str


class DirectoryEntry(BaseModel):
    name: str
    path: str


class DirectoryListing(BaseModel):
    path: str
    entries: list[DirectoryEntry]


class ModelStatus(BaseModel):
    ollama_available: bool
    llm_model: str
    llm_available: bool
    embedding_model: str
    embedding_available: bool
    error: str | None = None
