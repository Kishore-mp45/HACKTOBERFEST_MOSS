# Moss API Integration

`src/types/domain.ts` defines the frontend domain types. `src/lib/api/http.ts`
adapts the implemented FastAPI API to those types; the backend URL is the
origin only, and every request is sent under `/api`.

The frontend defaults to the local backend origin `http://127.0.0.1:8765`.
Set `NEXT_PUBLIC_MOSS_API_URL` to use another API origin. Synthetic demo data
is never selected in production; in development it requires the explicit
`NEXT_PUBLIC_MOSS_DEMO_MODE=true` flag and is ignored when an API URL is set.

## Implemented live endpoints

| Frontend capability | FastAPI endpoint |
|---|---|
| Health probe | `GET /api/health` |
| Get active workspace | `GET /api/workspace` |
| Authorize a workspace | `POST /api/workspace/configure` with `{ "path": "...", "name": "..." }` |
| Browse directories | `GET /api/workspace/browse?path=...` |
| Verify local model inventory | `GET /api/health/model-status` |
| Dashboard counts and attention | `GET /api/overview` |
| List files / file detail | `GET /api/files`, `GET /api/files/{id}` |
| File relationships | `GET /api/files/{id}/relationships` |
| AI-generated collections | `GET /api/collections` |
| Extracted action items | `GET /api/actions` |
| Duplicate candidates | `GET /api/duplicates` |
| Recommendations | `GET /api/recommendations`, `GET /api/recommendations/{id}` |
| Approve or reject a recommendation | `POST /api/approvals/{id}` with `{ "decision": "approve" }` or `{ "decision": "reject" }` |
| Bulk approve/reject pending recommendations | `POST /api/approvals/batch` with `recommendation_ids` and `decision` |
| Edit a pending rename or move | `POST /api/recommendations/{id}/edit` |
| Execute an approved recommendation | `POST /api/recommendations/{id}/execute` |
| Undo a successful file operation | `POST /api/operations/{execution_id}/undo` |
| Confirm or dismiss a collection | `POST /api/collections/{id}/confirm`, `POST /api/collections/{id}/dismiss` |
| Update action-item review status | `POST /api/actions/{id}/status` |
| Dismiss or reopen a duplicate candidate | `POST /api/duplicates/{id}/status` |
| Scan and operation history | `GET /api/activity` |
| Start a scan | `POST /api/jobs/scan` with `{ "force_reindex": false }` |
| Read scan status | `GET /api/jobs/{job_id}` |
| Stream scan progress | `GET /api/jobs/{job_id}/events` (Server-Sent Events) |

The service default is port `8765`. CORS allows the frontend development
origins on ports `3000` and `5173`.

## Data and privacy

- File paths returned in dashboard data are relative to the authorized
  workspace. The absolute root is only returned by workspace configuration
  and the directory browser so the user can select it.
- Recommendation source and destination paths are workspace-relative.
- The browser does not read file contents or perform filesystem operations.
  Approved operations are performed only by the local FastAPI service.
- The runtime status endpoint checks Ollama's local model tags; it does not
  run inference or download models.
- Action items include short evidence excerpts from the source document.

## Approval, execution, and undo

- Approval only records a human decision; it never changes a file. Execution
  requires that approval and re-validates the source and destination against
  the active workspace.
- Existing destination names are preserved; a collision receives a unique
  `_moss_1`, `_moss_2`, … suffix instead of overwriting a file.
- Successful moves and renames are recorded in SQLite. Undo refuses to
  overwrite an occupied original path and reports a clear error if the moved
  file is missing or outside the active workspace.
- Undo cannot recover a file deleted or moved externally. Cross-device moves
  use the platform copy-and-delete fallback and may not be atomic if
  interrupted. History is scoped to the active workspace.
- Each successful operation records a SHA-256 fingerprint; undo refuses to
  restore a file whose contents changed after execution.
- Resetting the active workspace clears its execution records and undo history.
- Collection decisions and action/duplicate review states are persisted.

Per-workspace file-type filters and exclusion patterns are not persisted yet,
so those controls remain disabled in live mode. Supported backend parsers are
PDF, DOCX, Markdown, and plain text. Recommendation responses contain a
rationale but no separate evidence excerpts or risk assessment; the UI labels
risk as not assessed instead of deriving it from confidence.

## Error behavior

Non-success HTTP responses become `MossApiError` values carrying the endpoint
and status. Network and timeout errors are not converted into mock data.
Scan progress uses SSE; if that stream disconnects, the store surfaces the
error and falls back to reading the specific job's status.
