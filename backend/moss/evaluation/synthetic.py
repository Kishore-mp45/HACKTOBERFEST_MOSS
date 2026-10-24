"""Evaluate the metric harness using deterministic synthetic mock outputs."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from sklearn.metrics import f1_score, normalized_mutual_info_score

from moss.services.embedding_service import compute_pairwise_similarity

ACTION_LINE = re.compile(r"^(?:TODO|Deadline):\s+\S.*$", re.MULTILINE)


def load_synthetic_dataset(dataset_path: Path) -> list[dict[str, Any]]:
    with dataset_path.open(encoding="utf-8") as dataset_file:
        data = json.load(dataset_file)
    if not isinstance(data, dict) or data.get("kind") != "synthetic_mock":
        raise ValueError("Evaluation input must identify itself as synthetic mock data.")
    documents = data.get("documents")
    if not isinstance(documents, list) or not documents:
        raise ValueError("Synthetic evaluation dataset must contain documents.")
    for document in documents:
        if (
            not isinstance(document, dict)
            or not isinstance(document.get("id"), str)
            or not isinstance(document.get("cluster"), str)
            or not isinstance(document.get("text"), str)
            or not isinstance(document.get("has_action"), bool)
            or not isinstance(document.get("mock_vector"), list)
            or not document["mock_vector"]
            or not all(
                isinstance(value, (int, float)) and not isinstance(value, bool)
                for value in document["mock_vector"]
            )
        ):
            raise ValueError("Synthetic evaluation document has an invalid schema.")
    return documents


def evaluate_synthetic_dataset(documents: list[dict[str, Any]]) -> dict[str, Any]:
    """Score the real clustering function and a deterministic rule-based mock extractor."""
    if not documents:
        raise ValueError("Synthetic evaluation dataset must contain documents.")

    ids = [document["id"] for document in documents]
    if len(set(ids)) != len(ids):
        raise ValueError("Synthetic evaluation document IDs must be unique.")

    vectors = [document["mock_vector"] for document in documents]
    if len({len(vector) for vector in vectors}) != 1:
        raise ValueError("Synthetic mock vectors must have equal dimensions.")
    _similarity_pairs, predicted_clusters = compute_pairwise_similarity(
        ids,
        vectors,
        threshold=0.75,
    )

    expected_actions = [document["has_action"] for document in documents]
    predicted_actions = [
        ACTION_LINE.search(document["text"]) is not None for document in documents
    ]
    true_positives = sum(
        expected and predicted
        for expected, predicted in zip(expected_actions, predicted_actions, strict=True)
    )
    false_positives = sum(
        not expected and predicted
        for expected, predicted in zip(expected_actions, predicted_actions, strict=True)
    )
    false_negatives = sum(
        expected and not predicted
        for expected, predicted in zip(expected_actions, predicted_actions, strict=True)
    )

    return {
        "evaluation_mode": "synthetic mock data; no model inference",
        "documents": len(documents),
        "ground_truth_clusters": len({document["cluster"] for document in documents}),
        "predicted_clusters": len(set(predicted_clusters)),
        "nmi": float(
            normalized_mutual_info_score(
                [document["cluster"] for document in documents],
                predicted_clusters,
            )
        ),
        "action_items": {
            "f1": float(f1_score(expected_actions, predicted_actions, zero_division=0)),
            "true_positives": true_positives,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
        },
        "method": {
            "clustering": (
                "Moss cosine similarity and agglomerative clustering "
                "using supplied mock vectors"
            ),
            "action_extraction": "simple TODO:/Deadline: marker rule; not an LLM",
        },
    }
