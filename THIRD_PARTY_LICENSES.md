# Third-Party License Inventory

This is a local development inventory, not legal advice. License metadata was
checked against the installed Python distributions and the installed frontend
package metadata during Phase 12 work. Frontend versions are reproducibly
resolved by `frontend/package-lock.json`; backend requirements in
`backend/pyproject.toml` are version ranges, not a lock file. The listed
Python versions are the versions present in the validation interpreter and
may differ from another installation.

## Backend Python packages

| Package | Observed version | License metadata |
|---|---:|---|
| Alembic | 1.20.1 | MIT |
| aiosqlite | 0.22.1 | MIT |
| FastAPI | 0.128.2 | MIT |
| httpx | 0.28.1 | BSD-3-Clause |
| NumPy | 2.5.3 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| pydantic-settings | 2.14.2 | MIT |
| pypdf | 6.21.2 | BSD-3-Clause |
| python-dateutil | 2.9.0.post0 | Dual-licensed (Apache-2.0 OR BSD-3-Clause; both permissive) |
| python-docx | 1.2.0 | MIT |
| scikit-learn | 1.7.2 | BSD-3-Clause |
| SQLAlchemy | 2.0.43 | MIT |
| Uvicorn | 0.40.0 | BSD-3-Clause |

Development-only tools observed in the same interpreter: pytest 8.4.2 (MIT),
pytest-asyncio 1.4.0 (Apache-2.0), pytest-cov 6.3.0 (MIT), mypy 1.20.2
(MIT), and Ruff 0.17.2 (MIT).

## Frontend packages

The license field in installed package metadata was checked for every direct
dependency in `frontend/package.json`. The direct packages report MIT except
for these entries:

| Package | Observed version | License metadata |
|---|---:|---|
| @playwright/test | 1.64.1 | Apache-2.0 |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| lucide-react | 0.525.0 | ISC |
| TypeScript | 5.7.3 | Apache-2.0 |

All remaining direct frontend runtime and development dependencies, including
Next.js, React, Radix UI, Tailwind CSS, ESLint, and their listed type packages,
report MIT in the installed package metadata. Transitive package metadata is
covered by the npm lockfile (`frontend/package-lock.json`).

## Model weights and runtime

| Component | Upstream license information | Verified local image / digest | Scope / limitation |
|---|---|---|---|
| Qwen3-4B (`Qwen3:4b`) | Apache-2.0 on the upstream model card | Ollama image ID `359d7dd4bcda` (2.5 GB) | Local runtime model; Apache-2.0 open-weights license. |
| nomic-embed-text (`nomic-embed-text:latest`) | Apache-2.0 on the upstream model card | Ollama image ID `0a109f422b47` (274 MB) | Local embedding model; Apache-2.0 open-weights license. |
| Ollama | MIT / user-installed external runtime | External loopback daemon (`127.0.0.1:11434`) | Moss does not bundle Ollama, download models, or redistribute model weights. |

Upstream references:

- [Qwen3-4B model card](https://huggingface.co/Qwen/Qwen3-4B)
- [nomic-embed-text-v1.5 model card](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
- [python-dateutil license information](https://dateutil.readthedocs.io/en/stable/license.html)

All direct and model runtime dependencies are permissively licensed (MIT, Apache-2.0, BSD-3-Clause, ISC). This project does not bundle external dependencies or model weights.
