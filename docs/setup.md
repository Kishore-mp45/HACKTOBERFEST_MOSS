# Development Setup

## Prerequisites

- Windows 10 or newer, macOS 12 or newer, or Ubuntu 22.04 or newer
- Python 3.11 or newer
- Node.js 20.9 or newer and npm
- Ollama installed and running locally
- The existing Ollama tags `Qwen3:4b` and `nomic-embed-text:latest`

Do not install or download additional Ollama models for Moss. Follow
[Local model setup](model_setup.md) to check the runtime and required tags.

## Backend

Create a virtual environment and install the backend development dependencies.
Run the commands from the repository root.

### Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
uvicorn moss.main:app --reload --host 127.0.0.1 --port 8765
```

If PowerShell blocks activation, use `.\.venv\Scripts\python.exe -m pip`
and `.\.venv\Scripts\uvicorn.exe` instead of changing the machine execution
policy.

### macOS / Linux

```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
uvicorn moss.main:app --reload --host 127.0.0.1 --port 8765
```

The API and interactive OpenAPI docs are available at
`http://127.0.0.1:8765` and `http://127.0.0.1:8765/docs`.

## Frontend

Open a second terminal from the repository root.

### Windows PowerShell

```powershell
cd frontend
npm ci
npm run dev
```

### macOS / Linux

```sh
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. This is a Next.js app, not a Vite app. It uses
the local API at `http://127.0.0.1:8765` by default. Set
`NEXT_PUBLIC_MOSS_API_URL` before starting Next.js only when the API is
available at a different origin.

## Configuration

Copy `backend/config.example.toml` to `backend/config.toml` and set
`[workspace].root_path` if you want to preconfigure a workspace. The file is
ignored by Git. Moss defaults to `Qwen3:4b` for generation and
`nomic-embed-text:latest` for embeddings; change these only to tags already
installed locally and compatible with their respective roles.

The API binds to loopback by default. The SQLite database is placed in the
operating-system application-data directory unless `[database].path` is set.
See [Architecture](architecture.md) for the data-flow and safety boundaries.

## Local checks

Backend, from `backend/`:

```powershell
python -m pytest
ruff check moss tests ..\scripts
mypy moss ..\scripts
```

Frontend, from `frontend/`:

```powershell
npm run typecheck
npm run lint
npm run build
```
