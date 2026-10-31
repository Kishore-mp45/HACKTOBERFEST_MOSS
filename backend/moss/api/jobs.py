"""Scan job endpoints."""

import json
import logging
from datetime import UTC, datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.database import session_dependency
from moss.models import Job, Workspace
from moss.schemas.job import JobResponse, ScanJobCreate

router = APIRouter(prefix="/api/jobs")
LOGGER = logging.getLogger(__name__)


@router.post("/scan", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
async def start_scan(
    payload: ScanJobCreate,
    request: Request,
    session: AsyncSession = Depends(session_dependency),
) -> Job:
    workspace_result = await session.execute(
        select(Workspace).where(Workspace.status == "active").order_by(Workspace.created_at)
    )
    workspace = workspace_result.scalars().first()
    if workspace is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Configure a workspace before starting a scan.",
        )

    job = Job(
        id=str(uuid4()),
        workspace_id=workspace.id,
        job_type="SCAN_FORCE" if payload.force_reindex else "SCAN",
        status="QUEUED",
        started_at=datetime.now(UTC),
    )
    session.add(job)
    await session.commit()
    await session.refresh(job)
    try:
        await request.app.state.job_queue.enqueue(job.id)
    except Exception as error:
        LOGGER.error("Could not enqueue scan job %s (%s)", job.id, type(error).__name__)
        job.status = "FAILED"
        job.error_log = [{"error": "The scan could not be queued. Try again."}]
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The scan could not be queued. Try again.",
        ) from None
    return job


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    session: AsyncSession = Depends(session_dependency),
) -> Job:
    result = await session.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found.")
    return job


@router.get("/{job_id}/events")
async def job_events(job_id: str, request: Request) -> StreamingResponse:
    async with request.app.state.session_factory() as session:
        result = await session.execute(select(Job.id).where(Job.id == job_id))
        if result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found.",
            )

    async def event_stream():
        async for event in request.app.state.job_queue.events(job_id):
            if await request.is_disconnected():
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
