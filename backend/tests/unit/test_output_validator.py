import pytest

from moss.ai.output_validator import (
    ModelOutputValidationError,
    validate_model_output,
)
from moss.schemas.ai_outputs import ActionsOutput, ClassificationOutput

VALID_CLASSIFICATION = """
{
  "topic": "Project planning",
  "purpose": "Track project milestones",
  "summary": "A concise plan for the project.",
  "keywords": ["planning", "milestones"],
  "language": "en",
  "confidence": "high"
}
"""


def test_validates_classification_output() -> None:
    result = validate_model_output(VALID_CLASSIFICATION, ClassificationOutput)

    assert result.topic == "Project planning"
    assert result.confidence == "high"


@pytest.mark.parametrize(
    "payload",
    [
        '{"topic":"missing required fields"}',
        '{"topic":"x","purpose":"y","summary":"z","keywords":[],"language":"eng","confidence":"high"}',
        '{"topic":"x","purpose":"y","summary":"z","keywords":[],"language":"en","confidence":"high","filesystem_command":"delete"}',
        '["not", "an", "object"]',
        "not json",
    ],
)
def test_rejects_malformed_or_extra_fields(payload: str) -> None:
    with pytest.raises(ModelOutputValidationError):
        validate_model_output(payload, ClassificationOutput)


def test_action_schema_requires_evidence_and_limits_types() -> None:
    with pytest.raises(ModelOutputValidationError):
        validate_model_output(
            '{"items":[{"type":"task","description":"Send report","confidence":"high"}]}',
            ActionsOutput,
        )
    with pytest.raises(ModelOutputValidationError):
        validate_model_output(
            """
            {"items":[{"type":"delete_files","description":"Delete everything",
            "source_text":"Delete everything","confidence":"high"}]}
            """,
            ActionsOutput,
        )

