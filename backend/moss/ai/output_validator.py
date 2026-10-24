"""Strict validation for structured model output."""

import json
from typing import TypeVar

from pydantic import BaseModel, ValidationError

OutputModel = TypeVar("OutputModel", bound=BaseModel)


class ModelOutputValidationError(ValueError):
    """Raised when model output cannot satisfy its required response schema."""


def validate_model_output(raw_output: str, output_model: type[OutputModel]) -> OutputModel:
    try:
        payload = json.loads(raw_output)
    except json.JSONDecodeError as error:
        raise ModelOutputValidationError("Model output was not valid JSON.") from error

    if not isinstance(payload, dict):
        raise ModelOutputValidationError("Model output must be a JSON object.")

    try:
        return output_model.model_validate(payload, strict=True)
    except ValidationError as error:
        raise ModelOutputValidationError(
            f"Model output did not match {output_model.__name__}: {error}"
        ) from error
