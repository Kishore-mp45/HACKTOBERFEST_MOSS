"""Run Moss's synthetic evaluation harness; this does not run local models."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from moss.evaluation.synthetic import evaluate_synthetic_dataset, load_synthetic_dataset


def main() -> None:
    repository_root = Path(__file__).resolve().parents[1]
    dataset_path = repository_root / "eval" / "dataset" / "synthetic_eval.json"
    result = evaluate_synthetic_dataset(load_synthetic_dataset(dataset_path))
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
