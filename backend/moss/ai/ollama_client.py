"""Async HTTP client for the local Ollama API."""

from __future__ import annotations

import asyncio
import logging
import math
from typing import Any

import httpx

from moss.config import Settings

LOGGER = logging.getLogger(__name__)


class OllamaError(RuntimeError):
    """Base error for failed local Ollama requests."""


class OllamaTimeoutError(OllamaError):
    """Raised when the local Ollama API exceeds its configured timeout."""


class OllamaRequestError(OllamaError):
    """Raised when Ollama returns an invalid or unsuccessful response."""


class OllamaModelUnavailableError(OllamaError):
    """Raised when a requested model tag is not installed locally."""


class OllamaClient:
    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
        retries: int = 1,
    ) -> None:
        self.settings = settings
        self._client = client
        self._owns_client = client is None
        self._retries = max(0, retries)

    async def __aenter__(self) -> OllamaClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=self.settings.ollama_base_url,
                timeout=httpx.Timeout(self.settings.llm_timeout_seconds),
            )
        return self

    async def __aexit__(self, *_args: object) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    async def chat(
        self,
        *,
        model: str,
        system: str,
        prompt: str,
        schema: dict[str, Any],
    ) -> str:
        payload = {
            "model": model,
            "stream": False,
            "think": False,
            "format": schema,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "options": {"temperature": 0},
        }
        response = await self._post("/api/chat", payload)
        message = response.get("message")
        content = message.get("content") if isinstance(message, dict) else None
        if not isinstance(content, str):
            raise OllamaRequestError("Ollama chat response did not include message content.")
        return content

    async def embed(self, *, model: str, inputs: str | list[str]) -> list[list[float]]:
        response = await self._post("/api/embed", {"model": model, "input": inputs})
        embeddings = response.get("embeddings")
        if not isinstance(embeddings, list):
            raise OllamaRequestError("Ollama embedding response did not include embeddings.")
        if any(
            not isinstance(vector, list)
            or not vector
            or any(not isinstance(value, (int, float)) for value in vector)
            for vector in embeddings
        ):
            raise OllamaRequestError("Ollama returned an invalid embedding vector.")
        if any(
            not all(math.isfinite(float(value)) for value in vector)
            for vector in embeddings
        ):
            raise OllamaRequestError("Ollama returned non-finite embedding values.")
        return [[float(value) for value in vector] for vector in embeddings]

    async def list_models(self) -> set[str]:
        client = await self._get_client()
        try:
            response = await client.get("/api/tags")
            response.raise_for_status()
            payload = response.json()
        except httpx.TimeoutException as error:
            raise OllamaTimeoutError("Timed out querying local Ollama model inventory.") from error
        except (httpx.HTTPError, ValueError) as error:
            raise OllamaRequestError(
                f"Could not query local Ollama model inventory: {error}"
            ) from error

        models = payload.get("models") if isinstance(payload, dict) else None
        if not isinstance(models, list) or any(not isinstance(model, dict) for model in models):
            raise OllamaRequestError("Ollama returned an invalid model inventory.")
        return {
            name
            for model in models
            if isinstance((name := model.get("name")), str)
        }

    async def ensure_models_available(self, *required_tags: str) -> None:
        available = await self.list_models()
        missing = [tag for tag in required_tags if tag not in available]
        if missing:
            raise OllamaModelUnavailableError(
                "Required Ollama model tags are not installed: "
                + ", ".join(missing)
                + ". Moss does not download models."
            )

    async def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        client = await self._get_client()
        for attempt in range(self._retries + 1):
            try:
                response = await client.post(path, json=payload)
                response.raise_for_status()
                result = response.json()
                if not isinstance(result, dict):
                    raise OllamaRequestError("Ollama returned a non-object response.")
                return result
            except httpx.TimeoutException as error:
                if attempt == self._retries:
                    raise OllamaTimeoutError(
                        f"Ollama request timed out after {self._retries + 1} attempts."
                    ) from error
                LOGGER.warning("Ollama request timed out; retrying once.")
            except httpx.HTTPStatusError as error:
                raise OllamaRequestError(
                    f"Ollama returned HTTP {error.response.status_code}."
                ) from error
            except httpx.RequestError as error:
                if attempt == self._retries:
                    raise OllamaRequestError(f"Could not reach local Ollama: {error}") from error
                LOGGER.warning(
                    "Ollama request failed; retrying once (%s)",
                    type(error).__name__,
                )
            except ValueError as error:
                raise OllamaRequestError("Ollama returned invalid JSON.") from error
            await asyncio.sleep(0.2 * (attempt + 1))
        raise OllamaRequestError("Ollama request did not complete.")

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            await self.__aenter__()
        if self._client is None:
            raise OllamaRequestError("Ollama HTTP client was not initialized.")
        return self._client
