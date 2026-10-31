import asyncio

import httpx
import pytest

from moss.ai.ollama_client import (
    OllamaClient,
    OllamaModelUnavailableError,
    OllamaRequestError,
    OllamaTimeoutError,
)
from moss.config import Settings


def test_chat_and_embedding_calls_use_local_ollama_endpoints() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/api/chat":
            return httpx.Response(200, json={"message": {"content": '{"ok":true}'}})
        if request.url.path == "/api/embed":
            return httpx.Response(200, json={"embeddings": [[0.25, -0.5]]})
        return httpx.Response(404)

    async def run() -> None:
        http_client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://localhost:11434",
        )
        try:
            ollama = OllamaClient(Settings(), client=http_client, retries=0)
            content = await ollama.chat(
                model="Qwen3:4b",
                system="system",
                prompt="untrusted document",
                schema={"type": "object"},
            )
            embeddings = await ollama.embed(
                model="nomic-embed-text:latest",
                inputs=["summary"],
            )
            assert content == '{"ok":true}'
            assert embeddings == [[0.25, -0.5]]
            assert [request.url.path for request in requests] == [
                "/api/chat",
                "/api/embed",
            ]
            assert all(request.url.host == "localhost" for request in requests)
        finally:
            await http_client.aclose()

    asyncio.run(run())


def test_raises_typed_timeout_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("timeout", request=request)

    async def run() -> None:
        http_client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://localhost:11434",
        )
        try:
            ollama = OllamaClient(Settings(), client=http_client, retries=0)
            with pytest.raises(OllamaTimeoutError):
                await ollama.chat(
                    model="Qwen3:4b",
                    system="system",
                    prompt="document",
                    schema={"type": "object"},
                )
        finally:
            await http_client.aclose()

    asyncio.run(run())


def test_retries_transient_local_request_failure() -> None:
    attempts = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise httpx.ConnectError("temporary local failure", request=request)
        return httpx.Response(200, json={"message": {"content": '{"ok":true}'}})

    async def run() -> None:
        http_client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://localhost:11434",
        )
        try:
            ollama = OllamaClient(Settings(), client=http_client, retries=1)
            content = await ollama.chat(
                model="Qwen3:4b",
                system="system",
                prompt="document",
                schema={"type": "object"},
            )
            assert content == '{"ok":true}'
            assert attempts == 2
        finally:
            await http_client.aclose()

    asyncio.run(run())


def test_refuses_missing_model_without_pull_attempt() -> None:
    requests: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request.url.path)
        return httpx.Response(200, json={"models": [{"name": "llama2:latest"}]})

    async def run() -> None:
        http_client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://localhost:11434",
        )
        try:
            ollama = OllamaClient(Settings(), client=http_client, retries=0)
            with pytest.raises(OllamaModelUnavailableError, match="does not download"):
                await ollama.ensure_models_available("Qwen3:4b")
            assert requests == ["/api/tags"]
        finally:
            await http_client.aclose()

    asyncio.run(run())


def test_rejects_nonfinite_embedding_vectors() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            content=b'{"embeddings":[[NaN]]}',
            headers={"content-type": "application/json"},
        )

    async def run() -> None:
        http_client = httpx.AsyncClient(
            transport=httpx.MockTransport(handler),
            base_url="http://localhost:11434",
        )
        try:
            ollama = OllamaClient(Settings(), client=http_client, retries=0)
            with pytest.raises(OllamaRequestError, match="non-finite"):
                await ollama.embed(model="nomic-embed-text:latest", inputs="summary")
        finally:
            await http_client.aclose()

    asyncio.run(run())
