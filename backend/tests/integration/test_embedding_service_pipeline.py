import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select

from moss.ai.ollama_client import OllamaRequestError
from moss.config import Settings
from moss.database import create_database, initialize_database
from moss.models import (
    Classification,
    ClusterGroup,
    DocumentRelationship,
    Embedding,
    FileRecord,
    Workspace,
)
from moss.services.embedding_service import EmbeddingService


class MockEmbeddingClient:
    def __init__(self) -> None:
        self.calls = 0

    async def embed(self, *, model: str, inputs: list[str]) -> list[list[float]]:
        assert model == "nomic-embed-text:latest"
        self.calls += 1
        return [
            [1.0, 0.0] if "alpha" in text else [0.8, 0.6]
            for text in inputs
        ]


def test_embedding_service_batches_caches_and_rebuilds_relationships(
    tmp_path: Path,
) -> None:
    async def run() -> None:
        root = tmp_path / "workspace"
        root.mkdir()
        database_path = tmp_path / "embedding.db"
        settings = Settings(
            database_path=str(database_path),
            embedding_batch_size=2,
            similarity_threshold=0.75,
            duplicate_threshold=0.92,
            enable_llm_clustering=False,
        )
        engine, session_factory = create_database(settings, database_path=database_path)
        await initialize_database(engine)
        client = MockEmbeddingClient()
        try:
            async with session_factory() as session:
                workspace = Workspace(name="test", root_path=str(root))
                session.add(workspace)
                await session.flush()
                records = [
                    FileRecord(
                        workspace_id=workspace.id,
                        relative_path=name,
                        absolute_path=str(root / name),
                        sha256_hash="same-hash" if name != "beta.txt" else "other-hash",
                    )
                    for name in ("alpha.txt", "alpha-copy.txt", "beta.txt")
                ]
                session.add_all(records)
                await session.flush()
                session.add_all(
                    [
                        Classification(
                            file_id=record.id,
                            topic="topic",
                            purpose="purpose",
                            summary="alpha subject" if index < 2 else "beta subject",
                            keywords=["alpha" if index < 2 else "beta"],
                            language="en",
                            confidence="high",
                        )
                        for index, record in enumerate(records)
                    ]
                )
                await session.commit()
                service = EmbeddingService(settings, client)
                report: dict[str, object] = {"errors": []}

                await service.process_workspace(session, workspace, report)
                embeddings = list((await session.execute(select(Embedding))).scalars())
                relationships = list(
                    (await session.execute(select(DocumentRelationship))).scalars()
                )

                assert report["embedded_files"] == 3
                assert client.calls == 2
                assert len(embeddings) == 3
                assert {item.relationship_type for item in relationships} == {
                    "EXACT_DUPLICATE",
                    "RELATED",
                }

                cached_report: dict[str, object] = {"errors": []}
                await service.process_workspace(session, workspace, cached_report)
                assert cached_report["embedded_files"] == 0
                assert client.calls == 2

                embeddings[0].vector_data = b"invalid"
                embeddings[0].dimensions = 2
                await session.commit()
                invalid_report: dict[str, object] = {"errors": []}
                await service.process_workspace(session, workspace, invalid_report)
                assert invalid_report["embedded_files"] == 0
        finally:
            await engine.dispose()

    asyncio.run(run())


def test_embedding_failures_are_sanitized_and_do_not_persist_vectors(
    tmp_path: Path,
    caplog,
) -> None:
    secret = "private-embedding-response"

    class FailingEmbeddingClient:
        async def embed(self, *, model: str, inputs: list[str]) -> list[list[float]]:
            del model, inputs
            raise OllamaRequestError(secret)

    async def run() -> tuple[dict[str, object], list[Embedding]]:
        root = tmp_path / "workspace"
        root.mkdir()
        database_path = tmp_path / "embedding.db"
        settings = Settings(database_path=str(database_path))
        engine, session_factory = create_database(settings, database_path=database_path)
        await initialize_database(engine)
        try:
            async with session_factory() as session:
                workspace = Workspace(name="test", root_path=str(root))
                session.add(workspace)
                await session.flush()
                record = FileRecord(
                    workspace_id=workspace.id,
                    relative_path="secret.txt",
                    absolute_path=str(root / "secret.txt"),
                )
                session.add(record)
                await session.flush()
                session.add(
                    Classification(
                        file_id=record.id,
                        topic="topic",
                        purpose="purpose",
                        summary="secret summary",
                        keywords=["secret"],
                        language="en",
                        confidence="high",
                    )
                )
                await session.commit()
                report: dict[str, object] = {"errors": []}
                await EmbeddingService(settings, FailingEmbeddingClient()).process_workspace(
                    session, workspace, report
                )
                embeddings = list((await session.execute(select(Embedding))).scalars())
                return report, embeddings
        finally:
            await engine.dispose()

    with caplog.at_level(logging.ERROR):
        report, embeddings = asyncio.run(run())

    assert secret not in caplog.text
    assert secret not in str(report)
    assert report["embedded_files"] == 0
    assert report["errors"]
    assert embeddings == []


def test_llm_cluster_refinement_merges_clusters_and_persists_names(
    tmp_path: Path,
) -> None:
    async def run() -> dict[str, object]:
        root = tmp_path / "workspace"
        root.mkdir()
        database_path = tmp_path / "cluster.db"
        settings = Settings(
            database_path=str(database_path),
            embedding_batch_size=4,
            similarity_threshold=0.75,
            duplicate_threshold=0.92,
        )

        class ClusterChatClient:
            def __init__(self) -> None:
                self.chat_calls = 0

            async def embed(self, *, model: str, inputs: list[str]) -> list[list[float]]:
                del model
                return [
                    [1.0, 0.0] if "alpha" in text else [0.8, 0.6] for text in inputs
                ]

            async def chat(self, **kwargs) -> str:
                del kwargs
                self.chat_calls += 1
                return json.dumps(
                    {
                        "clusters": [
                            {"cluster_id": 0, "group_name": "Alpha papers", "confidence": "high"},
                            {"cluster_id": 1, "group_name": "Beta notes", "confidence": "medium"},
                        ]
                    }
                )

        engine, session_factory = create_database(settings, database_path=database_path)
        await initialize_database(engine)
        try:
            async with session_factory() as session:
                workspace = Workspace(name="clusters", root_path=str(root))
                session.add(workspace)
                await session.flush()
                names = (
                    "alpha-1.txt",
                    "alpha-2.txt",
                    "alpha-3.txt",
                    "beta-1.txt",
                    "beta-2.txt",
                )
                records = [
                    FileRecord(
                        workspace_id=workspace.id,
                        relative_path=name,
                        absolute_path=str(root / name),
                        sha256_hash=f"hash-{index}",
                    )
                    for index, name in enumerate(names)
                ]
                session.add_all(records)
                await session.flush()
                session.add_all(
                    Classification(
                        file_id=record.id,
                        topic="topic",
                        purpose="purpose",
                        summary=(
                            "alpha subject" if record.relative_path.startswith("alpha")
                            else "beta subject"
                        ),
                        keywords=["kw"],
                        language="en",
                        confidence="high",
                    )
                    for record in records
                )
                await session.commit()

                client = ClusterChatClient()
                service = EmbeddingService(settings, client)
                report: dict[str, object] = {"errors": []}
                await service.process_workspace(session, workspace, report)

                relationships = list(
                    (await session.execute(select(DocumentRelationship))).scalars()
                )
                cluster_ids = {
                    relationship.cluster_id
                    for relationship in relationships
                    if relationship.cluster_id is not None
                }
                groups = list((await session.execute(select(ClusterGroup))).scalars())
                assert client.chat_calls == 1
                # Two embedding clusters merged into one by the LLM review.
                assert len(cluster_ids) == 1
                assert len(groups) == 1
                assert groups[0].name == "Alpha papers"
                assert groups[0].confidence == "high"
                # The merged cluster signature covers every member of both
                # embedding clusters, not just the first one.
                assert "|".join(sorted(record.id for record in records)) == (
                    groups[0].signature
                )

                # Disabling refinement restores the pure embedding grouping.
                disabled = settings.model_copy(update={"enable_llm_clustering": False})
                disabled_client = ClusterChatClient()
                await EmbeddingService(disabled, disabled_client).process_workspace(
                    session, workspace, {"errors": []}
                )
                relationships = list(
                    (await session.execute(select(DocumentRelationship))).scalars()
                )
                cluster_ids = {
                    relationship.cluster_id
                    for relationship in relationships
                    if relationship.cluster_id is not None
                }
                assert len(cluster_ids) == 2
                assert disabled_client.chat_calls == 0
                # With refinement disabled no ClusterGroup rows are produced or
                # kept: the LLM naming pass is purely additive.
                groups = list((await session.execute(select(ClusterGroup))).scalars())
                assert groups == []
                return {"ok": True}
        finally:
            await engine.dispose()

    asyncio.run(run())
