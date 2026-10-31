"""Strict output schemas for local model responses."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Confidence = Literal["high", "medium", "low"]

CONFIDENCE_RANK: dict[str, int] = {"high": 3, "medium": 2, "low": 1}


def confidence_rank(value: str) -> int:
    """Order confidence labels for comparisons (unknown values rank lowest)."""
    return CONFIDENCE_RANK.get(value, 0)


class ClassificationOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    topic: str = Field(min_length=1, max_length=100)
    purpose: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=1000)
    keywords: list[str] = Field(max_length=20)
    language: str = Field(pattern=r"^[a-z]{2}$")
    confidence: Confidence


class ActionItemOutput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    type: Literal["task", "deadline", "decision", "follow_up"]
    description: str = Field(min_length=1, max_length=1000)
    source_text: str = Field(min_length=1, max_length=2000)
    date_hint: str | None = Field(default=None, max_length=255)
    assignee_hint: str | None = Field(default=None, max_length=255)
    confidence: Confidence


class ActionsOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[ActionItemOutput] = Field(max_length=100)


class FilenameSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    filename: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=1, max_length=500)


class ClusterReviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    cluster_id: int = Field(ge=0)
    group_name: str = Field(min_length=1, max_length=80)
    merge_with: int | None = Field(default=None, ge=0)
    confidence: Confidence


class ClusterReviewOutput(BaseModel):
    """LLM refinement of embedding-based clusters (group naming and merging)."""

    model_config = ConfigDict(extra="forbid")

    clusters: list[ClusterReviewItem] = Field(max_length=200)
