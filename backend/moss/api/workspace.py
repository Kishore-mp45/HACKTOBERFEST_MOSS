"""Workspace configuration and directory browsing endpoints."""

from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from moss.ai.ollama_client import normalize_model_tag
from moss.config import Settings
from moss.database import session_dependency
from moss.models import ExecutionRecord, FileRecord, ProposedOperation, Recommendation, Workspace
from moss.schemas.workspace import (
    DirectoryEntry,
    DirectoryListing,
    ModelStatus,
    WorkspaceConfigureRequest,
    WorkspaceResponse,
)
from moss.security.path_guard import PathGuard, SecurityError

router = APIRouter(prefix="/api")


async def _active_workspace(session: AsyncSession) -> Workspace | None:
    result = await session.execute(
        select(Workspace).where(Workspace.status == "active").order_by(Workspace.created_at)
    )
    return result.scalars().first()


@router.get("/workspace", response_model=WorkspaceResponse | None)
async def get_workspace(
    session: AsyncSession = Depends(session_dependency),
) -> Workspace | None:
    return await _active_workspace(session)


@router.post(
    "/workspace/configure",
    response_model=WorkspaceResponse,
    status_code=status.HTTP_200_OK,
)
async def configure_workspace(
    payload: WorkspaceConfigureRequest,
    session: AsyncSession = Depends(session_dependency),
) -> Workspace:
    candidate = Path(payload.path).expanduser()
    try:
        root = candidate.resolve(strict=True)
    except (OSError, RuntimeError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Workspace path does not exist or cannot be resolved.",
        ) from error
    if not root.is_dir():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Workspace path must be an existing directory.",
        )

    await session.execute(
        update(Workspace).where(Workspace.status == "active").values(status="inactive")
    )
    result = await session.execute(select(Workspace).where(Workspace.root_path == str(root)))
    workspace = result.scalar_one_or_none()
    if workspace is None:
        workspace = Workspace(
            name=payload.name or root.name or str(root),
            root_path=str(root),
        )
        session.add(workspace)
    else:
        if payload.name:
            workspace.name = payload.name
        workspace.status = "active"
    await session.commit()
    await session.refresh(workspace)
    return workspace


@router.delete("/workspace", status_code=status.HTTP_204_NO_CONTENT)
async def clear_workspace(
    session: AsyncSession = Depends(session_dependency),
) -> None:
    workspace = await _active_workspace(session)
    if workspace is not None:
        execution_ids = (
            select(ProposedOperation.id)
            .join(
                Recommendation,
                Recommendation.id == ProposedOperation.recommendation_id,
            )
            .join(FileRecord, FileRecord.id == Recommendation.file_id)
            .where(FileRecord.workspace_id == workspace.id)
        )
        await session.execute(
            delete(ExecutionRecord).where(
                ExecutionRecord.proposed_op_id.in_(execution_ids)
            )
        )
    await session.execute(
        update(Workspace).where(Workspace.status == "active").values(status="inactive")
    )
    await session.commit()


@router.get("/workspace/browse", response_model=DirectoryListing)
async def browse_directories(
    path: str | None = Query(default=None, max_length=32768),
    session: AsyncSession = Depends(session_dependency),
) -> DirectoryListing:
    workspace = await _active_workspace(session)
    browsing_root = Path(workspace.root_path) if workspace else Path.home()
    requested = Path(path).expanduser() if path else browsing_root
    try:
        guard = PathGuard(browsing_root)
        directory = guard.validate(requested)
    except (OSError, RuntimeError, SecurityError) as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requested directory is outside the permitted browsing root.",
        ) from error

    if not directory.is_dir():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Requested path is not a directory.",
        )

    entries: list[DirectoryEntry] = []
    try:
        for entry in directory.iterdir():
            try:
                safe_path = guard.validate(entry)
            except (OSError, RuntimeError, SecurityError):
                continue
            if safe_path.is_dir():
                entries.append(DirectoryEntry(name=entry.name, path=str(safe_path)))
    except OSError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Directory cannot be read.",
        ) from error

    entries.sort(key=lambda item: item.name.casefold())
    return DirectoryListing(path=str(directory), entries=entries)


@router.get("/health/model-status", response_model=ModelStatus)
async def model_status(request: Request) -> ModelStatus:
    settings: Settings = request.app.state.settings
    endpoint = f"{settings.ollama_base_url}/api/tags"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(endpoint)
            response.raise_for_status()
            payload = response.json()
    except (httpx.RequestError, httpx.HTTPStatusError, ValueError) as error:
        return ModelStatus(
            ollama_available=False,
            llm_model=settings.llm_model,
            llm_available=False,
            embedding_model=settings.embedding_model,
            embedding_available=False,
            error=f"Could not query local Ollama model inventory: {error}",
        )

    if not isinstance(payload, dict):
        return ModelStatus(
            ollama_available=True,
            llm_model=settings.llm_model,
            llm_available=False,
            embedding_model=settings.embedding_model,
            embedding_available=False,
            error="Ollama returned an unexpected model inventory response.",
        )

    models = payload.get("models")
    if not isinstance(models, list):
        return ModelStatus(
            ollama_available=True,
            llm_model=settings.llm_model,
            llm_available=False,
            embedding_model=settings.embedding_model,
            embedding_available=False,
            error="Ollama returned an unexpected model inventory response.",
        )

    if not all(isinstance(model, dict) for model in models):
        return ModelStatus(
            ollama_available=True,
            llm_model=settings.llm_model,
            llm_available=False,
            embedding_model=settings.embedding_model,
            embedding_available=False,
            error="Ollama returned an unexpected model inventory response.",
        )
    available_tags = {model.get("name") for model in models}
    normalized_tags = {normalize_model_tag(tag) for tag in available_tags if isinstance(tag, str)}
    return ModelStatus(
        ollama_available=True,
        llm_model=settings.llm_model,
        llm_available=normalize_model_tag(settings.llm_model) in normalized_tags,
        embedding_model=settings.embedding_model,
        embedding_available=normalize_model_tag(settings.embedding_model) in normalized_tags,
    )
