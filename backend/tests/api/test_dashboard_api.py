from pathlib import Path

from fastapi.testclient import TestClient


def test_dashboard_endpoints_return_empty_workspace_state(
    client: TestClient, tmp_path: Path
) -> None:
    workspace = tmp_path / "garden"
    workspace.mkdir()
    configured = client.post(
        "/api/workspace/configure",
        json={"path": str(workspace), "name": "Garden"},
    )

    assert configured.status_code == 200
    assert configured.json()["name"] == "Garden"
    assert client.get("/api/files").json() == []
    assert client.get("/api/collections").json() == []
    assert client.get("/api/activity").json() == []

    overview = client.get("/api/overview")

    assert overview.status_code == 200
    assert overview.json()["stats"] == {
        "files_analyzed": 0,
        "files_pending": 0,
        "semantic_groups": 0,
        "duplicate_candidates": 0,
        "action_items": 0,
        "pending_recommendations": 0,
        "last_analyzed_at": None,
    }
    assert overview.json()["attention"] == []
