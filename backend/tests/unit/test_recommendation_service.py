from datetime import UTC, datetime

from moss.services.date_verification import verify_date_hint
from moss.services.recommendation_service import (
    is_generic_filename,
    recommendation_rank,
)


def test_date_verification_accepts_valid_future_date() -> None:
    assert verify_date_hint(
        "Submit report by November 15, 2026",
        today=datetime(2026, 10, 24, tzinfo=UTC),
    )


def test_date_verification_rejects_invalid_calendar_date() -> None:
    assert not verify_date_hint(
        "February 31, 2027",
        today=datetime(2026, 10, 24, tzinfo=UTC),
    )


def test_date_verification_rejects_ambiguous_numeric_date() -> None:
    assert not verify_date_hint(
        "03/04/2027",
        today=datetime(2026, 10, 24, tzinfo=UTC),
    )


def test_date_verification_rejects_missing_date() -> None:
    assert not verify_date_hint(None)
    assert not verify_date_hint("sometime soon")


def test_generic_filename_detection_is_limited_to_generic_stems() -> None:
    assert is_generic_filename("documents\\Untitled 2.txt")
    assert is_generic_filename("notes.pdf")
    assert not is_generic_filename("Project Notes.txt")


def test_recommendation_ranking_weights_confidence_and_recency() -> None:
    now = datetime(2026, 10, 24, tzinfo=UTC)
    recent = now.timestamp()
    old = datetime(2020, 1, 1, tzinfo=UTC).timestamp()

    assert recommendation_rank("high", recent, now) > recommendation_rank(
        "high", old, now
    )
    assert recommendation_rank("high", recent, now) > recommendation_rank(
        "medium", recent, now
    )
