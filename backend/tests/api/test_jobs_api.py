import asyncio
import sqlite3
import time
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from moss.config import Settings
from moss.database import create_database, initialize_database
from moss.main import create_app
from moss.models import Job, Workspace
from moss.schemas.ai_outputs import (
    ActionItemOutput,
    ActionsOutput,
    ClassificationOutput,
    FilenameSuggestion,
)


def test_scan_job_processes_workspace_and_streams_completion(
    client: TestClient, tmp_path: Path
) -> None:
    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()
    for index in range(3):
        (workspace_path / f"note-{index}.txt").write_text(
            f"Document {index} text.", encoding="utf-8"
        )
    client.post("/api/workspace/configure", json={"path": str(workspace_path)})

    response = client.post("/api/jobs/scan", json={"force_reindex": False})

    assert response.status_code == 202
    job_id = response.json()["id"]
    for _ in range(100):
        job_response = client.get(f"/api/jobs/{job_id}")
        if job_response.json()["status"] in {"COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"}:
            break
        time.sleep(0.02)

    assert job_response.json()["status"] == "COMPLETED"
    assert job_response.json()["processed_files"] == 3

    event_response = client.get(f"/api/jobs/{job_id}/events")
    replayed_events = client.get(f"/api/jobs/{job_id}/events")

    assert event_response.status_code == 200
    assert '"stage": "extraction"' in event_response.text
    assert '"type": "complete"' in event_response.text
    assert '"type": "complete"' in replayed_events.text


def test_scan_job_requires_configured_workspace(client: TestClient) -> None:
    response = client.post("/api/jobs/scan", json={})

    assert response.status_code == 409


def test_scan_runtime_failure_is_terminal_and_user_facing_error_is_sanitized(
    tmp_path: Path,
) -> None:
    class FailingRuntimeClient:
        async def __aenter__(self):
            raise RuntimeError("private-runtime-diagnostic")

        async def __aexit__(self, *_args: object) -> None:
            return None

    class FailingLLMService:
        def __init__(self) -> None:
            self.client = FailingRuntimeClient()

    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()
    (workspace_path / "notes.txt").write_text("Local scan fixture.", encoding="utf-8")
    database_path = tmp_path / "moss-failed-scan.db"
    application = create_app(
        settings=Settings(database_path=str(database_path)),
        database_path=database_path,
        llm_service_factory=FailingLLMService,
    )
    with TestClient(application) as test_client:
        assert test_client.post(
            "/api/workspace/configure",
            json={"path": str(workspace_path)},
        ).status_code == 200
        scan_response = test_client.post("/api/jobs/scan", json={})
        assert scan_response.status_code == 202
        job_id = scan_response.json()["id"]

        for _ in range(100):
            job_response = test_client.get(f"/api/jobs/{job_id}")
            if job_response.json()["status"] in {"COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"}:
                break
            time.sleep(0.02)

        assert job_response.json()["status"] == "FAILED"
        user_error = job_response.json()["error_log"][0]["error"]
        assert "private-runtime-diagnostic" not in user_error
        assert "could not be completed" in user_error
        events = test_client.get(f"/api/jobs/{job_id}/events").text
        assert "private-runtime-diagnostic" not in events
        assert '"type": "error"' in events


def test_scan_generates_embeddings_and_serves_relationships_without_ollama(
    tmp_path: Path,
) -> None:
    class MockEmbeddingClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def ensure_models_available(self, *_model_tags: str) -> None:
            return None

        async def embed(
            self,
            *,
            model: str,
            inputs: str | list[str],
        ) -> list[list[float]]:
            del model
            texts = [inputs] if isinstance(inputs, str) else inputs
            return [
                [1.0, 0.0, 0.0]
                if "alpha subject" in text
                else [0.0, 0.0, 1.0]
                if "gamma subject" in text
                else [0.7, 0.7, 0.0]
                if "delta subject" in text
                else [0.0, 1.0, 0.0]
                for text in texts
            ]

    class MockLLMService:
        def __init__(self) -> None:
            self.client = MockEmbeddingClient()

        async def classify_document(
            self,
            document_text: str,
        ) -> ClassificationOutput:
            alpha = "ALPHA" in document_text
            gamma = "GAMMA" in document_text
            topic = "Alpha" if alpha else "Gamma" if gamma else "Beta"
            summary = (
                "alpha subject"
                if alpha
                else "gamma subject"
                if gamma
                else "delta subject"
                if "DELTA" in document_text
                else "beta subject"
            )
            return ClassificationOutput(
                topic=topic,
                purpose="Record a topic",
                summary=summary,
                keywords=[summary.split()[0]],
                language="en",
                confidence="high",
            )

        async def extract_actions(self, document_text: str) -> ActionsOutput:
            if "Submit report by November 15, 2026." in document_text:
                return ActionsOutput(
                    items=[
                        ActionItemOutput(
                            type="deadline",
                            description="Submit the report",
                            source_text="Submit report by November 15, 2026.",
                            date_hint="November 15, 2026",
                            confidence="high",
                        ),
                        ActionItemOutput(
                            type="deadline",
                            description="  Submit   the report ",
                            source_text="Submit report by November 15, 2026.",
                            date_hint="November 15, 2026",
                            confidence="high",
                        ),
                    ]
                )
            return ActionsOutput(items=[])

        async def suggest_filename(self, _document_text: str) -> FilenameSuggestion:
            return FilenameSuggestion(
                filename="Gardening-Notes.txt",
                reason="The suggested name reflects the document's main topic.",
            )

    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()
    archive_path = workspace_path / "archive"
    archive_path.mkdir()
    (workspace_path / "alpha.txt").write_text("ALPHA meeting notes.", encoding="utf-8")
    (workspace_path / "alpha-copy.txt").write_text(
        "ALPHA meeting notes.", encoding="utf-8"
    )
    (archive_path / "alpha-paraphrase.txt").write_text(
        "ALPHA follow-up notes.", encoding="utf-8"
    )
    (workspace_path / "beta.txt").write_text("BETA gardening notes.", encoding="utf-8")
    (workspace_path / "document.txt").write_text(
        "GAMMA notes. Submit report by November 15, 2026.",
        encoding="utf-8",
    )
    (workspace_path / "Gardening-Notes.txt").write_text(
        "DELTA independent notes.",
        encoding="utf-8",
    )
    database_path = tmp_path / "moss.db"
    application = create_app(
        settings=Settings(database_path=str(database_path)),
        database_path=database_path,
        llm_service_factory=MockLLMService,
    )
    with TestClient(application) as test_client:
        assert test_client.post(
            "/api/workspace/configure",
            json={"path": str(workspace_path)},
        ).status_code == 200
        scan_response = test_client.post("/api/jobs/scan", json={})
        assert scan_response.status_code == 202
        job_id = scan_response.json()["id"]
        for _ in range(100):
            job_response = test_client.get(f"/api/jobs/{job_id}")
            if job_response.json()["status"] in {
                "COMPLETED",
                "COMPLETED_WITH_ERRORS",
                "FAILED",
            }:
                break
            time.sleep(0.02)

        assert job_response.json()["status"] == "COMPLETED"
        duplicates_response = test_client.get("/api/duplicates")
        assert duplicates_response.status_code == 200
        duplicates = duplicates_response.json()
        assert sum(item["duplicate_type"] == "EXACT_DUPLICATE" for item in duplicates) == 1
        assert sum(item["duplicate_type"] == "NEAR_DUPLICATE" for item in duplicates) == 2
        exact_pair = next(
            item for item in duplicates if item["duplicate_type"] == "EXACT_DUPLICATE"
        )
        relationships_response = test_client.get(
            f"/api/files/{exact_pair['file_a_id']}/relationships"
        )
        assert relationships_response.status_code == 200
        relationship_types = {
            item["relationship_type"] for item in relationships_response.json()
        }
        assert relationship_types == {"EXACT_DUPLICATE", "NEAR_DUPLICATE"}

        recommendations_response = test_client.get("/api/recommendations")
        assert recommendations_response.status_code == 200
        recommendations = recommendations_response.json()
        recommendation_types = {item["rec_type"] for item in recommendations}
        assert {
            "duplicate_review",
            "group_tag",
            "move",
            "rename",
        }.issubset(recommendation_types)
        conflict_rename = next(
            item
            for item in recommendations
            if item["rec_type"] == "rename" and item["relative_path"] == "document.txt"
        )
        assert conflict_rename["status"] == "CONFLICT"
        assert conflict_rename["proposed_operation"]["new_name"] == "Gardening-Notes.txt"
        assert not Path(conflict_rename["proposed_operation"]["source_path"]).is_absolute()
        assert not Path(conflict_rename["proposed_operation"]["dest_path"]).is_absolute()
        assert test_client.get(
            f"/api/recommendations/{conflict_rename['id']}"
        ).status_code == 200

        files_response = test_client.get("/api/files")
        assert files_response.status_code == 200
        files = files_response.json()
        assert len(files) == 6
        assert all(not Path(file["path"]).is_absolute() for file in files)
        assert test_client.get("/api/collections").status_code == 200

        overview_response = test_client.get("/api/overview")
        assert overview_response.status_code == 200
        assert overview_response.json()["stats"]["files_analyzed"] == 6
        assert overview_response.json()["recent_relationships"]
        activity_response = test_client.get("/api/activity")
        assert activity_response.status_code == 200
        assert activity_response.json()[0]["id"] == job_id

        actions_response = test_client.get("/api/actions?type=deadline")
        assert actions_response.status_code == 200
        actions = actions_response.json()
        assert len(actions) == 1
        assert actions[0]["date_verified"] is True
        assert actions[0]["source_text"] == "Submit report by November 15, 2026."
        assert test_client.get(
            f"/api/actions?file_id={actions[0]['file_id']}"
        ).json() == actions


def test_startup_marks_queued_and_running_jobs_interrupted(tmp_path: Path) -> None:
    database_path = tmp_path / "moss-restart.db"
    settings = Settings(database_path=str(database_path))

    async def seed_interrupted_jobs() -> None:
        engine, session_factory = create_database(settings, database_path=database_path)
        await initialize_database(engine)
        try:
            async with session_factory() as session:
                workspace = Workspace(name="test", root_path=str(tmp_path / "workspace"))
                session.add(workspace)
                await session.flush()
                session.add_all(
                    [
                        Job(
                            id="queued-job",
                            workspace_id=workspace.id,
                            job_type="SCAN",
                            status="QUEUED",
                        ),
                        Job(
                            id="running-job",
                            workspace_id=workspace.id,
                            job_type="SCAN",
                            status="RUNNING",
                        ),
                    ]
                )
                await session.commit()
        finally:
            await engine.dispose()

    asyncio.run(seed_interrupted_jobs())
    application = create_app(
        settings=settings,
        database_path=database_path,
        llm_service_factory=lambda: None,
    )
    with TestClient(application) as test_client:
        assert test_client.get("/api/jobs/queued-job").json()["status"] == "INTERRUPTED"
        assert test_client.get("/api/jobs/running-job").json()["status"] == "INTERRUPTED"


def test_restart_allows_manual_cache_backed_rescan_without_losing_extraction(
    tmp_path: Path,
) -> None:
    workspace_path = tmp_path / "selected"
    workspace_path.mkdir()
    source = workspace_path / "notes.txt"
    source.write_text("Persisted extraction survives restart.", encoding="utf-8")
    database_path = tmp_path / "moss-recovery.db"
    settings = Settings(database_path=str(database_path))
    first_application = create_app(
        settings=settings,
        database_path=database_path,
        llm_service_factory=lambda: None,
    )

    with TestClient(first_application) as first_client:
        assert first_client.post(
            "/api/workspace/configure",
            json={"path": str(workspace_path)},
        ).status_code == 200
        workspace_id = first_client.get("/api/workspace").json()["id"]
        initial_response = first_client.post("/api/jobs/scan", json={})
        assert initial_response.status_code == 202
        initial_job_id = initial_response.json()["id"]
        for _ in range(200):
            initial_job = first_client.get(f"/api/jobs/{initial_job_id}").json()
            if initial_job["status"] in {"COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"}:
                break
            time.sleep(0.02)
        assert initial_job["status"] == "COMPLETED"
        with sqlite3.connect(database_path) as connection:
            file_id, original_text = connection.execute(
                """
                SELECT file_records.id, extractions.full_text
                FROM file_records
                JOIN extractions ON extractions.file_id = file_records.id
                WHERE file_records.workspace_id = ?
                """,
                (workspace_id,),
            ).fetchone()

    interrupted_job_id = str(uuid4())
    with sqlite3.connect(database_path) as connection:
        connection.execute(
            """
            INSERT INTO jobs
                (id, workspace_id, job_type, status, total_files, processed_files,
                 error_log, started_at)
            VALUES (?, ?, 'SCAN', 'RUNNING', 1, 0, '[]', ?)
            """,
            (interrupted_job_id, workspace_id, datetime.now(UTC).isoformat()),
        )

    second_application = create_app(
        settings=settings,
        database_path=database_path,
        llm_service_factory=lambda: None,
    )
    with TestClient(second_application) as second_client:
        assert second_client.get(f"/api/jobs/{interrupted_job_id}").json()["status"] == (
            "INTERRUPTED"
        )
        retry_response = second_client.post("/api/jobs/scan", json={})
        assert retry_response.status_code == 202
        retry_job_id = retry_response.json()["id"]
        for _ in range(200):
            retry_job = second_client.get(f"/api/jobs/{retry_job_id}").json()
            if retry_job["status"] in {"COMPLETED", "COMPLETED_WITH_ERRORS", "FAILED"}:
                break
            time.sleep(0.02)
        assert retry_job["status"] == "COMPLETED"
        assert '"stage": "cache"' in second_client.get(
            f"/api/jobs/{retry_job_id}/events"
        ).text
        with sqlite3.connect(database_path) as connection:
            recovered = connection.execute(
                """
                SELECT file_records.id, extractions.full_text
                FROM file_records
                JOIN extractions ON extractions.file_id = file_records.id
                WHERE file_records.workspace_id = ?
                """,
                (workspace_id,),
            ).fetchone()

    assert recovered == (file_id, original_text)
    assert source.read_text(encoding="utf-8") == original_text
