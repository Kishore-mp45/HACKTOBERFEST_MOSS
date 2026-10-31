import numpy as np
import pytest

from moss.services.embedding_service import (
    compute_pairwise_similarity,
    deserialize_embedding,
    serialize_embedding,
)


def test_embedding_binary_round_trip_preserves_float32_values() -> None:
    vector = [0.25, -0.5, 1.0]

    encoded = serialize_embedding(vector)
    decoded = deserialize_embedding(encoded, dimensions=3)

    np.testing.assert_array_equal(decoded, np.asarray(vector, dtype=np.float32))


def test_embedding_deserializer_rejects_inconsistent_dimensions() -> None:
    with pytest.raises(ValueError, match="dimensions"):
        deserialize_embedding(b"\x00" * 4, dimensions=2)


def test_pairwise_similarity_filters_threshold_and_clusters_related_vectors() -> None:
    vectors = [
        [1.0, 0.0],
        [0.8, 0.6],
        [0.0, 1.0],
    ]

    pairs, labels = compute_pairwise_similarity(
        ["alpha", "similar", "unrelated"],
        vectors,
        threshold=0.75,
    )

    assert pairs == [("alpha", "similar", pytest.approx(0.8))]
    assert labels[0] == labels[1]
    assert labels[2] != labels[0]


def test_pairwise_similarity_reports_near_duplicates_at_configured_score() -> None:
    pairs, _labels = compute_pairwise_similarity(
        ["first", "second"],
        [[1.0, 0.0], [0.995, 0.1]],
        threshold=0.92,
    )

    assert len(pairs) == 1
    assert pairs[0][2] >= 0.92
