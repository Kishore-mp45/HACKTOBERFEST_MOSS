"""Embedding persistence and workspace similarity analysis."""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Sequence
from typing import Any
from uuid import uuid4

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.ai.ollama_client import OllamaClient, OllamaError, OllamaRequestError
from moss.config import Settings
from moss.models import (
    Classification,
    DocumentRelationship,
    Embedding,
    FileRecord,
    Workspace,
)

LOGGER = logging.getLogger(__name__)
MAX_COMPARISON_DOCUMENTS = 5000


def serialize_embedding(vector: Sequence[float]) -> bytes:
    array = np.asarray(vector, dtype=np.float32)
    if array.ndim != 1 or array.size == 0 or not np.isfinite(array).all():
        raise ValueError("Embedding must be a non-empty finite one-dimensional vector.")
    norm = np.linalg.norm(array)
    if not np.isfinite(norm) or norm == 0:
        raise ValueError("Embedding must have a finite, non-zero norm.")
    return array.tobytes()


def deserialize_embedding(vector_data: bytes, dimensions: int) -> np.ndarray:
    if dimensions <= 0 or len(vector_data) != dimensions * np.dtype(np.float32).itemsize:
        raise ValueError("Stored embedding dimensions do not match its binary data.")
    vector = np.frombuffer(vector_data, dtype=np.float32)
    norm = np.linalg.norm(vector)
    if not np.isfinite(vector).all() or not np.isfinite(norm) or norm == 0:
        raise ValueError("Stored embedding is non-finite or has a zero norm.")
    return vector


def compute_pairwise_similarity(
    file_ids: Sequence[str],
    vectors: Sequence[Sequence[float]] | np.ndarray,
    threshold: float,
) -> tuple[list[tuple[str, str, float]], list[int]]:
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim != 2 or matrix.shape[0] != len(file_ids) or matrix.shape[1] == 0:
        raise ValueError("Embedding matrix must contain one vector per file ID.")
    if not np.isfinite(matrix).all():
        raise ValueError("Embedding matrix contains non-finite values.")
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    if not np.isfinite(norms).all() or np.any(norms == 0):
        raise ValueError("Embedding matrix contains invalid vector norms.")
    normalized = matrix / norms
    similarities = normalized @ normalized.T
    similarities = np.clip(similarities, -1.0, 1.0)
    pairs = [
        (file_ids[left], file_ids[right], float(similarities[left, right]))
        for left in range(len(file_ids))
        for right in range(left + 1, len(file_ids))
        if similarities[left, right] >= threshold
    ]
    if len(file_ids) < 2 or threshold >= 1:
        return pairs, list(range(len(file_ids)))
    labels = AgglomerativeClustering(
        n_clusters=None,
        distance_threshold=1 - threshold,
        metric="cosine",
        linkage="average",
    ).fit_predict(normalized)
    return pairs, [int(label) for label in labels]


def detect_exact_duplicates(files: Sequence[FileRecord]) -> list[tuple[str, str]]:
    hashes: dict[str, list[str]] = defaultdict(list)
    for record in files:
        if record.sha256_hash:
            hashes[record.sha256_hash].append(record.id)
    pairs: list[tuple[str, str]] = []
    for matching_ids in hashes.values():
        for index, left_id in enumerate(matching_ids):
            for right_id in matching_ids[index + 1 :]:
                first, second = sorted((left_id, right_id))
                pairs.append((first, second))
    return pairs


class EmbeddingService:
    def __init__(self, settings: Settings, client: OllamaClient) -> None:
        self.settings = settings
        self.client = client

    async def process_workspace(
        self,
        session: AsyncSession,
        workspace: Workspace,
        report: dict[str, Any],
        force_reindex: bool = False,
    ) -> None:
        files_result = await session.execute(
            select(FileRecord).where(FileRecord.workspace_id == workspace.id)
        )
        files = list(files_result.scalars())
        file_by_id = {record.id: record for record in files}
        classifications_result = await session.execute(
            select(Classification, FileRecord)
            .join(FileRecord, Classification.file_id == FileRecord.id)
            .where(FileRecord.workspace_id == workspace.id)
            .order_by(FileRecord.id)
        )
        classified = list(classifications_result)

        embeddings_result = await session.execute(
            select(Embedding).where(Embedding.file_id.in_(file_by_id))
            if file_by_id
            else select(Embedding).where(Embedding.file_id == "")
        )
        stored_embeddings = {
            embedding.file_id: embedding for embedding in embeddings_result.scalars()
        }
        pending: list[tuple[Classification, FileRecord]] = [
            (classification, record)
            for classification, record in classified
            if force_reindex
            or record.id not in stored_embeddings
            or stored_embeddings[record.id].model_name != self.settings.embedding_model
            or stored_embeddings[record.id].dimensions <= 0
        ]
        if force_reindex:
            for _classification, record in pending:
                stale_embedding = stored_embeddings.pop(record.id, None)
                if stale_embedding is not None:
                    await session.delete(stale_embedding)
            await session.flush()
        embedded_count = 0

        for start in range(0, len(pending), self.settings.embedding_batch_size):
            batch = pending[start : start + self.settings.embedding_batch_size]
            inputs = [
                f"{classification.summary} {' '.join(classification.keywords or [])}".strip()
                for classification, _record in batch
            ]
            try:
                vectors = await self.client.embed(
                    model=self.settings.embedding_model,
                    inputs=inputs,
                )
                if len(vectors) != len(batch):
                    raise OllamaRequestError(
                        "Embedding response count did not match the request."
                    )
                if len({len(vector) for vector in vectors}) != 1:
                    raise OllamaRequestError(
                        "Embedding response vectors had inconsistent dimensions."
                    )
                prepared = [
                    serialize_embedding(vector)
                    for vector in vectors
                ]
            except (OllamaError, ValueError) as error:
                for _classification, record in batch:
                    report["errors"].append(
                        {
                            "file": record.relative_path,
                            "stage": "embedding",
                            "error": (
                                f"{type(error).__name__}: Embedding could not be generated; "
                                "check the backend logs."
                            ),
                        }
                    )
                LOGGER.error(
                    "Embedding batch failed for workspace %s (%s)",
                    workspace.id,
                    type(error).__name__,
                )
                continue

            for (_classification, record), vector_data, vector in zip(
                batch, prepared, vectors, strict=True
            ):
                dimensions = len(vector)
                embedding = stored_embeddings.get(record.id)
                if embedding is None:
                    embedding = Embedding(
                        file_id=record.id,
                        vector_data=vector_data,
                        dimensions=dimensions,
                        model_name=self.settings.embedding_model,
                    )
                    session.add(embedding)
                else:
                    embedding.vector_data = vector_data
                    embedding.dimensions = dimensions
                    embedding.model_name = self.settings.embedding_model
                stored_embeddings[record.id] = embedding
                embedded_count += 1
            await session.flush()

        await self._rebuild_relationships(
            session,
            workspace,
            files,
            stored_embeddings,
            file_by_id,
        )
        report["embedded_files"] = embedded_count
        relationships_result = await session.execute(
            select(DocumentRelationship).where(
                DocumentRelationship.file_a_id.in_(file_by_id),
                DocumentRelationship.relationship_type.in_(
                    ["RELATED", "NEAR_DUPLICATE"]
                ),
            )
            if file_by_id
            else select(DocumentRelationship).where(DocumentRelationship.file_a_id == "")
        )
        relationships = list(relationships_result.scalars())
        report["relationship_count"] = sum(
            relationship.relationship_type == "RELATED"
            for relationship in relationships
        )
        report["near_duplicate_count"] = sum(
            relationship.relationship_type == "NEAR_DUPLICATE"
            for relationship in relationships
        )
        report["exact_duplicate_count"] = sum(
            relationship.relationship_type == "EXACT_DUPLICATE"
            for relationship in relationships
        )

    async def _rebuild_relationships(
        self,
        session: AsyncSession,
        workspace: Workspace,
        files: list[FileRecord],
        stored_embeddings: dict[str, Embedding],
        file_by_id: dict[str, FileRecord],
    ) -> None:
        file_ids = list(file_by_id)
        if file_ids:
            await session.execute(
                delete(DocumentRelationship).where(
                    or_(
                        DocumentRelationship.file_a_id.in_(file_ids),
                        DocumentRelationship.file_b_id.in_(file_ids),
                    )
                )
            )

        exact_pairs = set(detect_exact_duplicates(files))
        for file_a_id, file_b_id in exact_pairs:
            session.add(
                DocumentRelationship(
                    file_a_id=file_a_id,
                    file_b_id=file_b_id,
                    similarity_score=1.0,
                    relationship_type="EXACT_DUPLICATE",
                )
            )

        usable: list[tuple[str, np.ndarray]] = []
        for record_id, embedding in stored_embeddings.items():
            if (
                record_id not in file_by_id
                or embedding.model_name != self.settings.embedding_model
            ):
                continue
            try:
                vector = deserialize_embedding(
                    embedding.vector_data, embedding.dimensions
                )
            except ValueError:
                LOGGER.warning("Ignoring invalid stored embedding for file %s", record_id)
                continue
            usable.append((record_id, vector))
        usable.sort(key=lambda item: item[0])
        if len(usable) > MAX_COMPARISON_DOCUMENTS:
            LOGGER.warning(
                "Workspace %s has %d embeddings; comparing a deterministic sample of %d",
                workspace.id,
                len(usable),
                MAX_COMPARISON_DOCUMENTS,
            )
            sample_indices = np.linspace(
                0,
                len(usable) - 1,
                MAX_COMPARISON_DOCUMENTS,
                dtype=int,
            )
            usable = [usable[index] for index in sample_indices]

        if len(usable) < 2:
            return
        dimensions = {vector.size for _file_id, vector in usable}
        if len(dimensions) != 1:
            LOGGER.warning("Skipping similarity analysis for mixed embedding dimensions.")
            return
        ids = [record_id for record_id, _vector in usable]
        vectors = np.stack([vector for _record_id, vector in usable])
        pairs, labels = compute_pairwise_similarity(
            ids,
            vectors,
            self.settings.similarity_threshold,
        )
        cluster_ids: dict[int, str] = {}
        cluster_sizes: dict[int, int] = defaultdict(int)
        for label in labels:
            cluster_sizes[label] += 1
        for label, size in cluster_sizes.items():
            if size > 1:
                cluster_ids[label] = str(uuid4())
        labels_by_id = dict(zip(ids, labels, strict=True))

        for file_a_id, file_b_id, similarity in pairs:
            pair = tuple(sorted((file_a_id, file_b_id)))
            if pair in exact_pairs:
                continue
            left_label = labels_by_id[file_a_id]
            right_label = labels_by_id[file_b_id]
            session.add(
                DocumentRelationship(
                    file_a_id=pair[0],
                    file_b_id=pair[1],
                    similarity_score=similarity,
                    relationship_type=(
                        "NEAR_DUPLICATE"
                        if similarity >= self.settings.duplicate_threshold
                        else "RELATED"
                    ),
                    cluster_id=(
                        cluster_ids[left_label]
                        if left_label == right_label
                        else None
                    ),
                )
            )
        await session.flush()
