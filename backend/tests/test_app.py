import httpx
from fastapi.testclient import TestClient


def test_health_endpoint_reports_ok(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cors_allows_only_development_origins(client: TestClient) -> None:
    frontend = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    allowed = client.options(
        "/api/health",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    rejected = client.options(
        "/api/health",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert frontend.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "access-control-allow-origin" not in rejected.headers


def test_model_status_reports_unavailable_without_inference(
    client: TestClient, monkeypatch
) -> None:
    class UnavailableOllamaClient:
        def __init__(self, timeout: float) -> None:
            assert timeout == 3.0

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args) -> None:
            return None

        async def get(self, url: str):
            raise httpx.ConnectError("Ollama is not running", request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "AsyncClient", UnavailableOllamaClient)
    response = client.get("/api/health/model-status")

    assert response.status_code == 200
    assert response.json()["llm_model"] == "Qwen3:4b"
    assert response.json()["embedding_model"] == "nomic-embed-text:latest"


def test_model_status_reads_existing_tags_without_running_inference(
    client: TestClient, monkeypatch
) -> None:
    class MockResponse:
        def raise_for_status(self) -> None:
            pass

        def json(self) -> dict[str, list[dict[str, str]]]:
            return {
                "models": [
                    {"name": "Qwen3:4b"},
                    {"name": "nomic-embed-text:latest"},
                ]
            }

    class MockAsyncClient:
        def __init__(self, timeout: float) -> None:
            assert timeout == 3.0

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args) -> None:
            return None

        async def get(self, url: str) -> MockResponse:
            assert url == "http://localhost:11434/api/tags"
            return MockResponse()

    monkeypatch.setattr(httpx, "AsyncClient", MockAsyncClient)
    response = client.get("/api/health/model-status")

    assert response.status_code == 200
    assert response.json()["ollama_available"] is True
    assert response.json()["llm_available"] is True
    assert response.json()["embedding_available"] is True
