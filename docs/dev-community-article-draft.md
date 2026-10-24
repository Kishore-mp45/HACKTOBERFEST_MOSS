# Draft: Moss, a Local-First Assistant for Organizing Document Backlogs

> Local draft only. Not submitted or published. The draft intentionally avoids
> claiming that synthetic fixtures measure model quality.

## The problem

Personal document folders accumulate meeting notes, plans, and reference
files. Finding related documents or remembering a follow-up often requires
manual searching across filenames and folders.

Moss is an experimental local-first document organization assistant. It
indexes supported files, identifies related documents, extracts evidence
from tasks and deadlines, and proposes organization changes for review.

## How it works

Moss uses a Next.js interface with a loopback-only FastAPI backend and SQLite
metadata storage. The configured Ollama models are the user's already
installed `Qwen3:4b` for structured generation and
`nomic-embed-text:latest` for embeddings. Moss does not pull models or send
document contents to a cloud model.

AI suggestions are not filesystem instructions. A user reviews and approves
each supported move or rename; execution validates that paths remain inside
the selected workspace, records the operation, and supports undo where
possible.

## Verification and limits

The backend suite completed with **114 passed, 1 skipped** (including the live offline scan pipeline test). The frontend workflow test passed with the HTTP adapter and exercised workspace setup, scanning UI, related-file navigation, action evidence, duplicate review, approval, execution, activity, and undo.

A live offline scan validation test (`test_offline_scan_full_pipeline`) verified the full pipeline using the local loopback Ollama runtime (`Qwen3:4b` and `nomic-embed-text:latest`), completing all stages end-to-end: text extraction, vector embedding generation, similarity analysis, action item extraction with source evidence, exact duplicate detection, and recommendation generation—with zero remote network access.

A generated 500-DOCX extraction-only benchmark recorded a 30.8248-second first scan and a 1.4311-second cached rescan (95.36% elapsed-time reduction) in that run, with a 403,812,352-byte peak process working set. It excluded Ollama inference and should not be interpreted as model latency.

The synthetic metric harness reported NMI 1.00 and action-item F1 0.833 (5 true positives, 1 false positive, and 1 false negative). Those figures validate deterministic mock scoring only; they are not real-world model quality measurements.

## Current status

Moss is a local development project, not a public release. Setup, model
requirements, safety boundaries, evaluation scope, and the synthetic demo
workspace are documented in the repository. GitHub publishing and release
tagging remain with the repository owner.

## Week 4 theme review

The Week 4 theme was not announced when this draft was prepared (October 25,
2026). Before submission, confirm the official theme and review the checklist
in [the implementation plan](../implementation_plan.md#h6-week-4-theme-re-evaluation-checklist).
Do not claim theme alignment until that review is complete.
