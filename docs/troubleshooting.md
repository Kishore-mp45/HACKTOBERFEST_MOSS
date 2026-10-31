# Troubleshooting

## Backend does not start

- Confirm Python 3.11 or newer is installed and the backend virtual
  environment is active.
- From `backend/`, install the project development dependencies with
  `python -m pip install -r requirements-dev.txt`.
- Confirm port `8765` is available. The service is intentionally bound to
  loopback (`127.0.0.1`).
- Open `http://127.0.0.1:8765/api/health` to check that the API is
  responding.

## Frontend does not start or cannot reach the API

- Confirm Node.js 20.9 or newer and npm are installed.
- From `frontend/`, run `npm ci` and then `npm run dev`.
- The Next.js development server uses port `3000`; open
  `http://localhost:3000`.
- Confirm the backend is running at `http://127.0.0.1:8765`. If using a
  different API origin, set `NEXT_PUBLIC_MOSS_API_URL` before starting the
  frontend.
- Check the browser console and backend terminal for the specific network or
  API error. See the [API reference](api_reference.md).

## Ollama is unavailable or a model is missing

- Run `ollama list` and verify the exact tags `Qwen3:4b` and
  `nomic-embed-text:latest`.
- Confirm the Ollama service responds at `http://localhost:11434`.
- Check `backend/config.toml` if you overrode the model tags or Ollama URL.
- Open `http://127.0.0.1:8765/api/health/model-status` for the configured
  model inventory status.

Moss does not pull models. Do not install or download any model for this
setup; use only compatible tags already present locally. Model-status checks
do not invoke inference.

## Workspace cannot be selected or scanned

- Choose an existing, readable directory and ensure the backend process has
  permission to access it.
- Moss confines browsing and filesystem operations to the selected
  workspace; links or paths outside it are rejected.
- Supported document formats are PDF, DOCX, Markdown, and plain text.
- Files above the configured size limit or files that fail parsing are
  reported as skipped/failed without stopping the rest of the scan.

## Scan appears interrupted

Jobs that were queued or running when the backend stopped are marked
`INTERRUPTED`; they do not automatically resume. Start a new scan from the
application. Persisted extraction is reused from the cache when eligible,
so a rescan can continue without repeating successful extraction.

## A recommendation did not change a file

Recommendations are suggestions, not automatic actions. Review and approve a
recommendation, then execute it separately. A move or rename may be rejected
if its source changed, a path leaves the active workspace, or the destination
already exists. Successful operations can be undone from Activity when the
original path is still available.

## More diagnostics

- API health: `http://127.0.0.1:8765/api/health`
- Model inventory: `http://127.0.0.1:8765/api/health/model-status`
- Interactive API docs: `http://127.0.0.1:8765/docs`
- See [Local model setup](model_setup.md) and [Development setup](setup.md).
