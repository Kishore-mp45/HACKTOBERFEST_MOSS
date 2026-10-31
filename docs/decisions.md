# Architecture Decisions

Status: Phase 1 decisions for the Moss MVP.

## D-001: Local model runtime and generation model

- **Decision:** Use Ollama with the already-downloaded `Qwen3:4b` model for document classification, action extraction, and recommendation explanations.
- **Rationale:** It is the most resource-conscious general-purpose generation model in the supplied inventory and is preferable to the older `llama2:latest` for instruction-following tasks. `gemma4:31b-cloud` is not a local model, while `gemma4:latest` has a substantially larger listed download.
- **Constraints:** Do not download or install additional models. The application must not pull models automatically. If either required model is missing, report that clearly and tell the user which existing model tag is expected.
- **Output handling:** Request structured JSON and validate every response against the corresponding Pydantic schema. Model output never authorizes filesystem operations.
- **Performance:** The supplied sizes are model/download sizes, not observed RAM use or latency. No local inference or benchmark was run; performance remains unmeasured and hardware-dependent.

## D-002: Embedding model

- **Decision:** Use the already-downloaded `nomic-embed-text:latest` through Ollama for embeddings.
- **Rationale:** It is the embedding model in the supplied inventory and satisfies the local inference requirement. Generation and embedding remain separately configurable.
- **Constraints:** Do not download or install any replacement embedding model. Missing-model handling follows D-001.
- **Performance:** No local embedding call or benchmark was run.

## D-003: Model inventory

The user-provided Ollama inventory lists:

| Ollama tag | Listed size | Use / disposition |
|---|---:|---|
| `Qwen3:4b` | 2.5 GB | Selected for generation |
| `nomic-embed-text:latest` | 274 MB | Selected for embeddings |
| `llama2:latest` | 3.8 GB | Not selected; older generation model |
| `gemma4:latest` | 9.6 GB | Not selected as default; larger listed download |
| `gemma4:31b-cloud` | Not shown as a local download | Not selected; cloud conflicts with local-only/offline requirements |

These sizes alone do not establish runtime memory requirements or comparative inference speed.

## D-004: Model and dependency licenses

Use permissively licensed dependencies where practical for the planned open-source distribution.

| Component | License recorded for the decision | Decision |
|---|---|---|
| Qwen3 model weights | Apache-2.0 | Use; include the model license/attribution in release materials |
| `nomic-embed-text` weights | Apache-2.0 | Use; include the model license/attribution in release materials |
| `pypdf` | BSD-3-Clause | Use for PDF text extraction |
| `python-docx` | MIT | Use for DOCX extraction |
| scikit-learn | BSD-3-Clause | Use for clustering |
| PyMuPDF | AGPL-3.0 | Do not use in the MVP; avoid the additional copyleft obligations |

Upstream project/model references:

- [Qwen3-4B model card](https://huggingface.co/Qwen/Qwen3-4B)
- [nomic-embed-text-v1.5 model card](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
- [pypdf project](https://github.com/py-pdf/pypdf)
- [python-docx project](https://github.com/python-openxml/python-docx)
- [scikit-learn project](https://github.com/scikit-learn/scikit-learn)
- [PyMuPDF project](https://github.com/pymupdf/PyMuPDF)

Project license metadata should be checked against the exact dependency/model versions before release. Network access was unavailable during Phase 1, so the links were not fetched in this session. This is an engineering decision record, not legal advice.

## D-005: PDF parser

- **Decision:** Use `pypdf` rather than PyMuPDF for MVP PDF text extraction.
- **Rationale:** PyMuPDF is AGPL-3.0; `pypdf` is BSD-3-Clause and avoids introducing that copyleft dependency into the planned MIT-licensed application.
- **Trade-off:** Text extraction fidelity may be lower for some PDFs. Scanned documents without OCR remain out of scope.

## D-006: Background job queue

- **Decision:** Use an in-process `asyncio.Queue` and a background `asyncio.Task`; stream progress to the UI with Server-Sent Events.
- **Rationale:** The MVP is a local, single-tenant application with one backend process and sequential scans. An external broker such as Celery/Redis adds deployment complexity without a current requirement.
- **Constraint:** Queue state is not durable across process restarts. Persist job status/progress as required for UI reporting, and mark interrupted jobs clearly at startup; do not claim that queued work resumes automatically.
- **Revisit if:** Concurrent multi-user workloads, multiple backend workers, durable scheduled jobs, or restart-resume become requirements.

## D-007: Database

- **Decision:** Use SQLite with SQLAlchemy for application metadata, cached extraction, classifications, embeddings, recommendations, and operation history.
- **Rationale:** The MVP is local and single-tenant; the planned workload does not require a separately managed database server. SQLite keeps setup simple and stores data outside the user's workspace.
- **Constraints:** Use transactions and schema migrations; enable WAL mode where supported. Keep database files in the OS application-data directory, not in the scanned workspace.
- **Revisit if:** Multi-user access, multiple backend processes with sustained write contention, or deployment beyond a local single-user application is introduced.

## D-008: Workspace selection

- **Decision:** Use the backend directory-browser API (Strategy A) to let the user select a workspace.
- **Rationale:** It avoids requiring a manually typed path or adding Electron packaging to the MVP.
- **Security requirements:** Bind the server to loopback; return directory names only; validate canonical paths against the approved root; do not follow links outside the allowed workspace; never expose file contents through the browse endpoint.

## D-009: Verification boundary for Phase 1

- **Decision:** Proceed to Phase 2 without downloading models, running local inference, or benchmarking model latency.
- **Rationale:** The user explicitly requested implementation using only models already downloaded.
- **Unverified:** Hardware specifications, actual model residency/RAM, inference latency, JSON-schema adherence on real documents, and embedding output at runtime. Do not represent these as tested or measured.
