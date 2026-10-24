from pathlib import Path

from fastapi.testclient import TestClient


def test_configure_workspace_and_get_saved_workspace(
    client: TestClient, tmp_path: Path
) -> None:
    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()

    response = client.post("/api/workspace/configure", json={"path": str(workspace_path)})

    assert response.status_code == 200
    assert response.json()["root_path"] == str(workspace_path.resolve())
    assert client.get("/api/workspace").json()["id"] == response.json()["id"]


def test_rejects_invalid_workspace_paths(client: TestClient, tmp_path: Path) -> None:
    missing = client.post(
        "/api/workspace/configure",
        json={"path": str(tmp_path / "does-not-exist")},
    )
    file_path = tmp_path / "document.txt"
    file_path.write_text("private file content", encoding="utf-8")
    not_directory = client.post("/api/workspace/configure", json={"path": str(file_path)})

    assert missing.status_code == 422
    assert not_directory.status_code == 422


def test_directory_browser_returns_only_directory_names(
    client: TestClient, tmp_path: Path
) -> None:
    workspace_path = tmp_path / "selected"
    child_directory = workspace_path / "subfolder"
    child_directory.mkdir(parents=True)
    (workspace_path / "secret.txt").write_text("must not leak", encoding="utf-8")
    (child_directory / "nested-secret.txt").write_text("also secret", encoding="utf-8")
    client.post("/api/workspace/configure", json={"path": str(workspace_path)})

    response = client.get("/api/workspace/browse")

    assert response.status_code == 200
    assert [entry["name"] for entry in response.json()["entries"]] == ["subfolder"]
    assert "must not leak" not in response.text
    assert "nested-secret.txt" not in response.text


def test_directory_browser_rejects_paths_outside_workspace(
    client: TestClient, tmp_path: Path
) -> None:
    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    client.post("/api/workspace/configure", json={"path": str(workspace_path)})

    response = client.get("/api/workspace/browse", params={"path": str(outside)})

    assert response.status_code == 403


def test_delete_clears_active_configuration_without_deleting_data(
    client: TestClient, tmp_path: Path
) -> None:
    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()
    client.post("/api/workspace/configure", json={"path": str(workspace_path)})

    response = client.delete("/api/workspace")

    assert response.status_code == 204
    assert client.get("/api/workspace").json() is None
    assert workspace_path.is_dir()
