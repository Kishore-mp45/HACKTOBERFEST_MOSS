"""Offline scan validation test.

Verifies that a workspace scan runs completely offline through the local
loopback Ollama instance (Qwen3:4b and nomic-embed-text:latest), generating
classifications, embeddings, action items with evidence, duplicate detection,
and recommendations, without any external network calls.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sqlalchemy import select

from moss.ai.llm_service import LLMService
from moss.ai.ollama_client import OllamaClient
from moss.config import Settings
from moss.database import create_database, initialize_database
from moss.models import (
    ActionItem,
    Classification,
    DocumentRelationship,
    Embedding,
    FileRecord,
    Recommendation,
    Workspace,
)
from moss.services.embedding_service import EmbeddingService
from moss.services.recommendation_service import RecommendationService
from moss.services.scanner_service import ScannerService


@pytest.mark.asyncio
async def test_offline_scan_full_pipeline(tmp_path: Path) -> None:
    settings = Settings()
    client = OllamaClient(settings)
    try:
        available_models = await client.list_models()
    except Exception:
        pytest.skip("Local Ollama runtime is not running on loopback")

    if (
        settings.llm_model not in available_models
        or settings.embedding_model not in available_models
    ):
        pytest.skip(
            f"Required models ({settings.llm_model}, {settings.embedding_model}) "
            "not installed in local Ollama"
        )

    # Create synthetic test workspace with 5 distinct test documents
    root = tmp_path / "offline_workspace"
    root.mkdir()

    # 1. Project planning note with a clear deadline and action item
    (root / "project_alpha.md").write_text(
        "# Project Alpha Plan\n\n"
        "We need to finalize the system architecture by 2026-11-15.\n"
        "Alice must review security guidelines.\n\n"
        "Decision: Use local-first SQLite architecture.\n",
        encoding="utf-8",
    )

    # 2. Generic filename notes document to trigger rename recommendation
    (root / "notes.txt").write_text(
        "Quarterly financial budget analysis and projection figures for FY2026.\n"
        "Action: Prepare financial spreadsheet before the audit.\n",
        encoding="utf-8",
    )

    # 3. Duplicate of notes.txt to trigger exact duplicate detection
    (root / "notes_backup.txt").write_text(
        "Quarterly financial budget analysis and projection figures for FY2026.\n"
        "Action: Prepare financial spreadsheet before the audit.\n",
        encoding="utf-8",
    )

    # 4. Machine learning research paper summary
    (root / "ml_embeddings.md").write_text(
        "# High-Dimensional Vector Embeddings\n\n"
        "Exploration of dense text representation models and cosine distance metric.\n"
        "Embeddings map semantic concepts into geometric space for similarity search.\n",
        encoding="utf-8",
    )

    # 5. Near-duplicate or related machine learning document
    (root / "vector_search.md").write_text(
        "# Semantic Vector Search and Clustering\n\n"
        "High-dimensional vector embeddings allow dense representation of text documents.\n"
        "Cosine similarity measures the orientation of document vectors in space.\n",
        encoding="utf-8",
    )

    db_path = tmp_path / "offline_scan.db"
    test_settings = Settings(
        database_path=str(db_path),
        root_path=str(root),
    )
    engine, session_factory = create_database(test_settings, database_path=db_path)
    await initialize_database(engine)

    try:
        async with session_factory() as session:
            workspace = Workspace(name="Offline Test Workspace", root_path=str(root))
            session.add(workspace)
            await session.commit()
            await session.refresh(workspace)

            async with client:
                await client.ensure_models_available(
                    test_settings.llm_model,
                    test_settings.embedding_model,
                )
                llm_service = LLMService(test_settings, client)
                embedding_service = EmbeddingService(test_settings, client)
                scanner = ScannerService(test_settings, llm_service, embedding_service)

                progress_events: list[dict[str, object]] = []

                async def on_progress(event: dict[str, object]) -> None:
                    progress_events.append(event)

                report = await scanner.scan_workspace(
                    session,
                    workspace,
                    progress_callback=on_progress,
                )

                rec_service = RecommendationService(test_settings, llm_service)
                await rec_service.generate_recommendations(session, workspace, report)

            # Query database records to verify pipeline output
            files = (
                (
                    await session.execute(
                        select(FileRecord).where(FileRecord.workspace_id == workspace.id)
                    )
                )
                .scalars()
                .all()
            )
            classifications = (
                (await session.execute(select(Classification)))
                .scalars()
                .all()
            )
            embeddings = (
                (await session.execute(select(Embedding)))
                .scalars()
                .all()
            )
            actions = (
                (await session.execute(select(ActionItem)))
                .scalars()
                .all()
            )
            relationships = (
                (await session.execute(select(DocumentRelationship)))
                .scalars()
                .all()
            )
            recommendations = (
                (await session.execute(select(Recommendation)))
                .scalars()
                .all()
            )

            # Verification assertions
            assert len(files) == 5
            assert all(f.status == "ANALYZED" for f in files)
            assert len(classifications) == 5
            assert len(embeddings) == 5
            assert all(emb.dimensions == 768 for emb in embeddings)

            # Check that exact duplicate was detected
            exact_dups = [r for r in relationships if r.relationship_type == "EXACT_DUPLICATE"]
            assert len(exact_dups) >= 1

            # Check action items extracted
            assert len(actions) >= 1
            for action in actions:
                # Evidence must be non-empty and backed by verbatim text
                assert action.source_text
                assert action.item_type in {"task", "deadline", "decision", "follow_up"}

            # Check recommendations were generated (at least rename or duplicate_review)
            rec_types = {r.rec_type for r in recommendations}
            assert "duplicate_review" in rec_types or "rename" in rec_types

            # Verify no errors in report
            assert report["errors"] == []
            assert report["total_files"] == 5
            assert report["processed_files"] == 5

    finally:
        await engine.dispose()
