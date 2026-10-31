import json
from pathlib import Path

import pytest

from moss.evaluation.synthetic import (
    evaluate_synthetic_dataset,
    load_synthetic_dataset,
)

DATASET_PATH = (
    Path(__file__).resolve().parents[3]
    / "eval"
    / "dataset"
    / "synthetic_eval.json"
)


def test_synthetic_evaluation_reports_actual_mock_metrics() -> None:
    result = evaluate_synthetic_dataset(load_synthetic_dataset(DATASET_PATH))

    assert result["evaluation_mode"] == "synthetic mock data; no model inference"
    assert result["documents"] == 12
    assert result["ground_truth_clusters"] == 3
    assert result["predicted_clusters"] == 3
    assert result["nmi"] == pytest.approx(1.0)
    assert result["action_items"] == {
        "f1": pytest.approx(5 / 6),
        "true_positives": 5,
        "false_positives": 1,
        "false_negatives": 1,
    }


def test_evaluator_rejects_non_synthetic_dataset(tmp_path: Path) -> None:
    dataset_path = tmp_path / "invalid.json"
    dataset_path.write_text(json.dumps({"kind": "model_output", "documents": []}))

    with pytest.raises(ValueError, match="synthetic mock"):
        load_synthetic_dataset(dataset_path)


def test_evaluator_rejects_mismatched_vector_dimensions() -> None:
    documents = [
        {
            "id": "one",
            "cluster": "group",
            "mock_vector": [1.0, 0.0],
            "text": "Plain note.",
            "has_action": False,
        },
        {
            "id": "two",
            "cluster": "group",
            "mock_vector": [1.0],
            "text": "Plain note.",
            "has_action": False,
        },
    ]

    with pytest.raises(ValueError, match="equal dimensions"):
        evaluate_synthetic_dataset(documents)
