# API Reference

## Health

`GET /api/health`

Returns `200 OK` when the FastAPI process is responding:

```json
{"status": "ok"}
```

## Model status

`GET /api/health/model-status`

Checks whether the local Ollama service responds to its model inventory endpoint and whether the configured model tags are present. This route does not run inference or download models.

## Workspace

- `GET /api/workspace` — Return the active workspace configuration, or `null` if none is configured.
- `POST /api/workspace/configure` — Configure an existing directory. Request: `{"path":"C:\\Users\\you\\Documents"}`.
- `GET /api/workspace/browse?path=...` — List child directory names inside the active workspace (or the user home directory before one is configured). File names and contents are not returned.
- `DELETE /api/workspace` — Clear the active workspace selection without deleting the workspace or indexed data.

Workspace paths are canonicalized; browse requests cannot escape the active browsing root.

## Scan jobs

- `POST /api/jobs/scan` — Queue a scan for the active workspace. Request: `{"force_reindex":false}`. Returns `202` with the job record; returns `409` if no workspace is active.
- `GET /api/jobs/{job_id}` — Read persisted status and progress.
- `GET /api/jobs/{job_id}/events` — Receive progress events as Server-Sent Events until completion or failure. Events can be replayed to reconnecting clients while the current backend process is running.

Supported formats are PDF, DOCX, Markdown, and plain text. Extraction results are cached by file hash and modification time; the force-reindex request bypasses that cache. Files larger than the configured limit are recorded as `SKIPPED_TOO_LARGE`. Per-file extraction and AI-analysis failures are recorded on the job and do not stop the remaining scan.

Scans use the configured, already-installed Ollama generation model to produce structured classifications and evidence-backed action items. A missing model fails the job with an explicit error; Moss does not download models. Invalid model output is retried once, then the affected analysis is marked failed without saving fabricated output. Document text is treated as untrusted input and cannot authorize filesystem operations.

Scans also embed each classification summary and its keywords with the configured, already-installed embedding model. Vectors are stored as float32 SQLite BLOBs and used to find related documents (default cosine similarity threshold `0.75`) and near-duplicates (default `0.92`). Exact duplicates are identified by SHA-256 hash. For workspaces with more than 5,000 embedded documents, similarity comparisons use a deterministic sample; exact-duplicate detection still examines all indexed files.

## Files and duplicates

- `GET /api/files/{file_id}/relationships` — Return related and duplicate documents for a file in the active workspace, including similarity and cluster ID.
- `GET /api/duplicates` — Return persisted exact and near-duplicate candidates for the active workspace.

## Recommendations and actions

- `GET /api/recommendations` — List ranked recommendations for the active workspace. Optional filters: `type` (for example, `rename`, `move`, `duplicate_review`, or `group_tag`) and `status`.
- `GET /api/recommendations/{recommendation_id}` — Return one recommendation, its evidence/explanation, ranking score, and proposed operation when applicable.
- `GET /api/actions` — List extracted action items. Optional filters: `type` (`task`, `deadline`, `decision`, or `follow_up`) and `file_id`.

Action evidence is required to match an exact excerpt from the document. Repeated action items with the same normalized description and source excerpt are deduplicated per file. Date hints are marked verified only when they parse as a calendar date and are not an ambiguous numeric date; verification does not imply that the deadline is in the future.

Rename suggestions use the local generation model, then sanitize the proposed name and retain the original file extension. Cluster-based move proposals use a deterministic `Related/<topic>` destination. Existing destination paths are marked `CONFLICT`. Suggestions do not change files unless the user separately approves and executes a supported operation.

## Dashboard

- `GET /api/overview` — Return workspace summary statistics and current status.
- `GET /api/files` — List indexed workspace files and available classification data.
- `GET /api/files/{file_id}` — Return one indexed file in the active workspace.
- `GET /api/collections` — List related-document collections.
- `GET /api/activity` — List recent operation and workspace activity.

These routes return indexed metadata and analysis results, not raw document
contents.

## Review and approval

- `POST /api/approvals/{recommendation_id}` — Approve or reject one pending
  recommendation.
- `POST /api/approvals/batch` — Approve or reject a batch of pending
  recommendations.
- `POST /api/recommendations/{recommendation_id}/edit` — Edit a pending
  operation proposal while preserving workspace path restrictions.
- `POST /api/collections/{cluster_id}/confirm` and
  `POST /api/collections/{cluster_id}/dismiss` — Record a collection review.
- `POST /api/actions/{action_id}/status` — Update an action-item review status.
- `POST /api/duplicates/{relationship_id}/status` — Update a duplicate
  candidate review status.

Request bodies are defined in the generated OpenAPI documentation at
`http://127.0.0.1:8765/docs`.

## Filesystem operations

- `POST /api/recommendations/{recommendation_id}/execute` — Execute an
  approved supported move or rename recommendation.
- `POST /api/operations/{execution_id}/undo` — Undo a successful operation
  when its original location is available.

Approval and execution are separate. Before changing the filesystem, the
backend verifies the recommendation approval, confirms that the source still
matches the indexed file, constrains paths to the active workspace, and
prevents destination overwrites. It records successful operations for
activity history and undo. Group-tag recommendations do not change files.
