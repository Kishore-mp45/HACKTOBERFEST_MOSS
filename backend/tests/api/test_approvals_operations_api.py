import sqlite3
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

from moss.config import Settings
from moss.main import create_app


def _seed_file(
    database_path: Path,
    workspace_id: str,
    root: Path,
    relative_path: str,
) -> str:
    file_id = str(uuid4())
    absolute_path = root / relative_path
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    absolute_path.write_text(f"contents for {relative_path}", encoding="utf-8")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO file_records
                (id, workspace_id, relative_path, absolute_path, file_size_bytes, status)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                file_id,
                workspace_id,
                relative_path,
                str(absolute_path),
                absolute_path.stat().st_size,
                "ANALYZED",
            ),
        )
    return file_id


def _seed_recommendation(
    database_path: Path,
    workspace_id: str,
    root: Path,
    relative_path: str = "notes.txt",
    destination: Path | None = None,
) -> tuple[str, str, Path]:
    file_id = _seed_file(database_path, workspace_id, root, relative_path)
    recommendation_id = str(uuid4())
    operation_id = str(uuid4())
    source = root / relative_path
    destination = destination or root / "Archive" / Path(relative_path).name
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO recommendations
                (id, file_id, rec_type, explanation, confidence, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                recommendation_id,
                file_id,
                "move",
                "Move the file into the archive.",
                "high",
                "PENDING",
                datetime.now(UTC).isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO proposed_operations
                (id, recommendation_id, op_type, source_path, dest_path)
            VALUES (?, ?, ?, ?, ?)
            """,
            (operation_id, recommendation_id, "MOVE", str(source), str(destination)),
        )
    return recommendation_id, file_id, source


def _configured_workspace(
    client: TestClient,
    database_path: Path,
    root: Path,
) -> str:
    root.mkdir(parents=True, exist_ok=True)
    response = client.post("/api/workspace/configure", json={"path": str(root)})
    assert response.status_code == 200
    with sqlite3.connect(database_path) as connection:
        row = connection.execute(
            "SELECT id FROM workspaces WHERE root_path = ? AND status = 'active'",
            (str(root.resolve()),),
        ).fetchone()
    assert row is not None
    return str(row[0])


def test_approve_execute_and_undo_restores_real_file(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    workspace_id = _configured_workspace(client, Path(settings.database_path), root)
    recommendation_id, file_id, source = _seed_recommendation(
        Path(settings.database_path), workspace_id, root
    )

    approved = client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "APPROVED"
    assert source.exists()
    assert not (root / "Archive" / "notes.txt").exists()

    executed = client.post(f"/api/recommendations/{recommendation_id}/execute")
    assert executed.status_code == 200
    assert executed.json()["status"] == "APPLIED"
    destination = root / "Archive" / "notes.txt"
    assert destination.read_text(encoding="utf-8") == "contents for notes.txt"
    assert not source.exists()

    activity = client.get("/api/activity").json()
    execution = next(item for item in activity if item["related_file_ids"] == [file_id])
    assert execution["undoable"] is True
    operation_id = execution["operation_id"]

    undone = client.post(f"/api/operations/{operation_id}/undo")
    assert undone.status_code == 200
    assert undone.json()["undone"] is True
    assert undone.json()["undoable"] is False
    assert source.read_text(encoding="utf-8") == "contents for notes.txt"
    assert not destination.exists()
    assert client.post(f"/api/operations/{operation_id}/undo").status_code == 409
    assert client.delete("/api/workspace").status_code == 204
    assert client.get("/api/activity").json() == []
    assert client.post("/api/workspace/configure", json={"path": str(root)}).status_code == 200
    assert all(
        item["operation_id"] is None
        for item in client.get("/api/activity").json()
    )


def test_execution_auto_renames_destination_conflicts(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    workspace_id = _configured_workspace(client, Path(settings.database_path), root)
    existing = root / "Archive" / "notes.txt"
    existing.parent.mkdir()
    existing.write_text("keep this", encoding="utf-8")
    recommendation_id, _file_id, source = _seed_recommendation(
        Path(settings.database_path), workspace_id, root
    )

    assert client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    ).status_code == 200
    response = client.post(f"/api/recommendations/{recommendation_id}/execute")

    assert response.status_code == 200
    assert existing.read_text(encoding="utf-8") == "keep this"
    assert (root / "Archive" / "notes_moss_1.txt").exists()
    assert not source.exists()


def test_unapproved_or_out_of_workspace_operation_never_moves_file(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    outside = tmp_path / "outside.txt"
    workspace_id = _configured_workspace(client, Path(settings.database_path), root)
    recommendation_id, _file_id, source = _seed_recommendation(
        Path(settings.database_path),
        workspace_id,
        root,
        destination=outside,
    )

    unapproved = client.post(f"/api/recommendations/{recommendation_id}/execute")
    assert unapproved.status_code == 409
    assert source.exists()

    approval = client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    )
    assert approval.status_code == 403
    escaped = client.post(f"/api/recommendations/{recommendation_id}/execute")
    assert escaped.status_code == 409
    assert source.exists()
    assert not outside.exists()


def test_batch_approval_is_atomic_and_does_not_execute_files(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    first, _, first_source = _seed_recommendation(database_path, workspace_id, root, "a.txt")
    second, _, second_source = _seed_recommendation(database_path, workspace_id, root, "b.txt")

    response = client.post(
        "/api/approvals/batch",
        json={"recommendation_ids": [first, second], "decision": "approve"},
    )

    assert response.status_code == 200
    assert [item["status"] for item in response.json()] == ["APPROVED", "APPROVED"]
    assert first_source.exists()
    assert second_source.exists()


def test_edit_and_reject_recommendations_without_touching_files(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    recommendation_id, _file_id, source = _seed_recommendation(
        database_path, workspace_id, root
    )

    edited = client.post(
        f"/api/recommendations/{recommendation_id}/edit",
        json={"proposed": "Reviewed/"},
    )
    assert edited.status_code == 200
    assert edited.json()["proposed_operation"]["dest_path"] == "Reviewed/notes.txt"
    assert source.exists()
    assert client.post(
        f"/api/recommendations/{recommendation_id}/edit",
        json={"proposed": "../outside/"},
    ).status_code == 403

    rejected = client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "reject"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "REJECTED"
    assert source.exists()
    assert not (root / "Reviewed" / "notes.txt").exists()


def test_undo_missing_moved_file_returns_clear_conflict(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    workspace_id = _configured_workspace(client, Path(settings.database_path), root)
    recommendation_id, _file_id, _source = _seed_recommendation(
        Path(settings.database_path), workspace_id, root
    )
    assert client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    ).status_code == 200
    assert client.post(f"/api/recommendations/{recommendation_id}/execute").status_code == 200
    moved = root / "Archive" / "notes.txt"
    moved.unlink()

    activity = next(
        event
        for event in client.get("/api/activity").json()
        if event["undoable"]
    )
    response = client.post(f"/api/operations/{activity['operation_id']}/undo")

    assert response.status_code == 409
    assert "moved file is missing" in response.json()["detail"]


def test_collection_action_and_duplicate_decisions_are_persisted(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    first_file = _seed_file(database_path, workspace_id, root, "first.txt")
    second_file = _seed_file(database_path, workspace_id, root, "second.txt")
    action_id = str(uuid4())
    relationship_id = str(uuid4())
    cluster_id = str(uuid4())
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO action_items
                (
                    id, file_id, item_type, description, source_text, confidence,
                    date_verified, extracted_at
                )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                action_id,
                first_file,
                "task",
                "Call the office",
                "Call them Friday.",
                "high",
                0,
                datetime.now(UTC).isoformat(),
            ),
        )
        connection.execute(
            """
            INSERT INTO document_relationships
                (id, file_a_id, file_b_id, similarity_score, relationship_type, cluster_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (relationship_id, first_file, second_file, 1.0, "EXACT_DUPLICATE", cluster_id),
        )

    assert client.get("/api/actions").json()[0]["status"] == "NEW"
    assert client.get("/api/duplicates").json()[0]["status"] == "OPEN"
    assert client.get("/api/collections").json()[0]["origin"] == "ai"

    assert client.post(
        f"/api/actions/{action_id}/status", json={"status": "verified"}
    ).status_code == 200
    assert client.get("/api/actions").json()[0]["status"] == "VERIFIED"
    assert client.post(
        f"/api/duplicates/{relationship_id}/status",
        json={"status": "dismissed"},
    ).status_code == 200
    assert client.get("/api/duplicates").json()[0]["status"] == "DISMISSED"
    assert client.post(f"/api/collections/{cluster_id}/confirm").status_code == 200
    assert client.get("/api/collections").json()[0]["origin"] == "confirmed"
    assert client.post(f"/api/collections/{cluster_id}/dismiss").status_code == 200
    assert client.get("/api/collections").json() == []


def test_execution_rejects_traversal_even_with_a_persisted_approval(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    outside = tmp_path / "outside.txt"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    recommendation_id, _file_id, source = _seed_recommendation(
        database_path,
        workspace_id,
        root,
        destination=root / ".." / outside.name,
    )
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE recommendations SET status = 'APPROVED' WHERE id = ?",
            (recommendation_id,),
        )
        connection.execute(
            """
            INSERT INTO approvals
                (id, recommendation_id, decision, decided_at)
            VALUES (?, ?, 'APPROVE', ?)
            """,
            (str(uuid4()), recommendation_id, datetime.now(UTC).isoformat()),
        )

    response = client.post(f"/api/recommendations/{recommendation_id}/execute")

    assert response.status_code == 403
    assert source.exists()
    assert not outside.exists()


def test_undo_rejects_a_tampered_path_outside_the_workspace(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    recommendation_id, _file_id, source = _seed_recommendation(
        database_path, workspace_id, root
    )
    assert client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    ).status_code == 200
    assert client.post(
        f"/api/recommendations/{recommendation_id}/execute"
    ).status_code == 200
    moved = root / "Archive" / "notes.txt"
    outside = tmp_path / "outside.txt"
    outside.write_text("do not overwrite", encoding="utf-8")
    activity = next(item for item in client.get("/api/activity").json() if item["undoable"])
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE execution_records SET final_path = ? WHERE id = ?",
            (str(outside), activity["operation_id"]),
        )

    response = client.post(
        f"/api/operations/{activity['operation_id']}/undo"
    )

    assert response.status_code == 403
    assert moved.read_text(encoding="utf-8") == "contents for notes.txt"
    assert outside.read_text(encoding="utf-8") == "do not overwrite"
    assert not source.exists()


def test_rename_operation_executes_and_can_be_undone(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    recommendation_id, _file_id, source = _seed_recommendation(
        database_path, workspace_id, root
    )
    renamed = root / "renamed.txt"
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            UPDATE proposed_operations
            SET op_type = 'RENAME', dest_path = ?, new_name = ?
            WHERE recommendation_id = ?
            """,
            (str(renamed), renamed.name, recommendation_id),
        )

    assert client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    ).status_code == 200
    assert client.post(
        f"/api/recommendations/{recommendation_id}/execute"
    ).status_code == 200
    assert renamed.exists()
    assert not source.exists()
    activity = next(item for item in client.get("/api/activity").json() if item["undoable"])

    undone = client.post(f"/api/operations/{activity['operation_id']}/undo")

    assert undone.status_code == 200
    assert source.exists()
    assert not renamed.exists()


def test_execute_rejects_operation_type_and_untracked_source(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    unsupported, _, unsupported_source = _seed_recommendation(
        database_path, workspace_id, root, "unsupported.txt"
    )
    mismatched, _, mismatched_source = _seed_recommendation(
        database_path, workspace_id, root, "tracked.txt"
    )
    other_source = root / "other.txt"
    other_source.write_text("not the tracked source", encoding="utf-8")
    with sqlite3.connect(database_path) as connection:
        for recommendation_id in (unsupported, mismatched):
            connection.execute(
                "UPDATE recommendations SET status = 'APPROVED' WHERE id = ?",
                (recommendation_id,),
            )
            connection.execute(
                """
                INSERT INTO approvals (id, recommendation_id, decision, decided_at)
                VALUES (?, ?, 'APPROVE', ?)
                """,
                (str(uuid4()), recommendation_id, datetime.now(UTC).isoformat()),
            )
        connection.execute(
            "UPDATE proposed_operations SET op_type = 'DELETE' WHERE recommendation_id = ?",
            (unsupported,),
        )
        connection.execute(
            "UPDATE proposed_operations SET source_path = ? WHERE recommendation_id = ?",
            (str(other_source), mismatched),
        )

    unsupported_response = client.post(f"/api/recommendations/{unsupported}/execute")
    mismatch_response = client.post(f"/api/recommendations/{mismatched}/execute")

    assert unsupported_response.status_code == 409
    assert mismatch_response.status_code == 409
    assert unsupported_source.exists()
    assert mismatched_source.exists()
    assert other_source.exists()


def test_batch_decision_rejects_non_pending_recommendations_atomically(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    first, _, _ = _seed_recommendation(database_path, workspace_id, root, "first.txt")
    second, _, _ = _seed_recommendation(database_path, workspace_id, root, "second.txt")
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            "UPDATE recommendations SET status = 'APPLIED' WHERE id = ?",
            (second,),
        )

    response = client.post(
        "/api/approvals/batch",
        json={"recommendation_ids": [first, second], "decision": "approve"},
    )

    assert response.status_code == 409
    with sqlite3.connect(database_path) as connection:
        status_by_id = dict(
            connection.execute(
                "SELECT id, status FROM recommendations WHERE id IN (?, ?)",
                (first, second),
            ).fetchall()
        )
        approval_count = connection.execute(
            "SELECT COUNT(*) FROM approvals WHERE recommendation_id = ?",
            (first,),
        ).fetchone()[0]
    assert status_by_id == {first: "PENDING", second: "APPLIED"}
    assert approval_count == 0


def test_batch_approval_rejects_out_of_workspace_destinations(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    recommendation_id, _file_id, source = _seed_recommendation(
        database_path,
        workspace_id,
        root,
        destination=root / ".." / "outside.txt",
    )

    response = client.post(
        "/api/approvals/batch",
        json={"recommendation_ids": [recommendation_id], "decision": "approve"},
    )

    assert response.status_code == 403
    assert source.exists()
    with sqlite3.connect(database_path) as connection:
        status = connection.execute(
            "SELECT status FROM recommendations WHERE id = ?",
            (recommendation_id,),
        ).fetchone()[0]
        approval_count = connection.execute(
            "SELECT COUNT(*) FROM approvals WHERE recommendation_id = ?",
            (recommendation_id,),
        ).fetchone()[0]
    assert status == "PENDING"
    assert approval_count == 0


def test_undo_refuses_to_overwrite_an_occupied_original_path(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    recommendation_id, _file_id, source = _seed_recommendation(
        database_path, workspace_id, root
    )
    assert client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    ).status_code == 200
    assert client.post(
        f"/api/recommendations/{recommendation_id}/execute"
    ).status_code == 200
    moved = root / "Archive" / "notes.txt"
    source.write_text("new file at original path", encoding="utf-8")
    activity = next(item for item in client.get("/api/activity").json() if item["undoable"])

    response = client.post(f"/api/operations/{activity['operation_id']}/undo")

    assert response.status_code == 409
    assert moved.read_text(encoding="utf-8") == "contents for notes.txt"
    assert source.read_text(encoding="utf-8") == "new file at original path"


def test_approved_group_tag_records_review_without_filesystem_changes(
    client: TestClient,
    settings,
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    database_path = Path(settings.database_path)
    workspace_id = _configured_workspace(client, database_path, root)
    first_file = _seed_file(database_path, workspace_id, root, "first.txt")
    second_file = _seed_file(database_path, workspace_id, root, "second.txt")
    recommendation_id = str(uuid4())
    cluster_id = str(uuid4())
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO recommendations
                (id, file_id, rec_type, explanation, confidence, status, created_at)
            VALUES (?, ?, 'group_tag', 'Review this group', 'high', 'PENDING', ?)
            """,
            (recommendation_id, first_file, datetime.now(UTC).isoformat()),
        )
        connection.execute(
            """
            INSERT INTO document_relationships
                (id, file_a_id, file_b_id, similarity_score, relationship_type, cluster_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid4()),
                first_file,
                second_file,
                0.9,
                "RELATED",
                cluster_id,
            ),
        )

    assert client.post(
        f"/api/approvals/{recommendation_id}",
        json={"decision": "approve"},
    ).status_code == 200
    response = client.post(f"/api/recommendations/{recommendation_id}/execute")

    assert response.status_code == 200
    assert "no files were changed" in response.json()["result_message"]
    assert (root / "first.txt").exists()
    assert (root / "second.txt").exists()
    assert client.get("/api/collections").json()[0]["origin"] == "confirmed"


@pytest.mark.asyncio
async def test_async_api_covers_approval_execution_and_undo(
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    database_path = tmp_path / "async-api.db"
    application = create_app(
        settings=Settings(database_path=str(database_path)),
        database_path=database_path,
        llm_service_factory=lambda: None,
    )
    async with application.router.lifespan_context(application):
        async with AsyncClient(
            transport=ASGITransport(app=application),
            base_url="http://testserver",
        ) as client:
            configured = await client.post(
                "/api/workspace/configure",
                json={"path": str(root)},
            )
            assert configured.status_code == 200
            workspace_id = configured.json()["id"]
            recommendation_id, _file_id, source = _seed_recommendation(
                database_path, workspace_id, root
            )

            approved = await client.post(
                f"/api/approvals/{recommendation_id}",
                json={"decision": "approve", "user_note": "Reviewed"},
            )
            executed = await client.post(
                f"/api/recommendations/{recommendation_id}/execute"
            )
            activity = await client.get("/api/activity")
            undoable = next(item for item in activity.json() if item["undoable"])
            undone = await client.post(
                f"/api/operations/{undoable['operation_id']}/undo"
            )

            assert approved.status_code == 200
            assert executed.status_code == 200
            assert undone.status_code == 200
            assert source.exists()
