"""Scan job API schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ScanJobCreate(BaseModel):
    force_reindex: bool = False


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    workspace_id: str
    job_type: str
    status: str
    total_files: int
    processed_files: int
    error_log: list[dict[str, object]]
    started_at: datetime | None
    finished_at: datetime | None
