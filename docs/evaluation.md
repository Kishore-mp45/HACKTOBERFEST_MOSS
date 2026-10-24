# Testing and Evaluation

## Verified Phase 11 results

| Check | Result | Scope |
|---|---:|---|
| Backend test suite | 113 passed, 1 skipped | Local automated tests |
| Backend line coverage | 88.95% | Coverage.py configured for greenlet and thread concurrency; the project gate is 80% |
| Frontend workflow E2E | 1 passed | Playwright; success, unavailable-model status, scan-queue failure, operation failure, and undo use isolated synthetic API fixtures; no live backend or model inference |
| Synthetic clustering NMI | 1.00 | Fabricated topic labels and fixed mock vectors |
| Synthetic action-item F1 | 0.833 (5 TP, 1 FP, 1 FN) | Deterministic `TODO:` / `Deadline:` rule against fabricated labels |
| Synthetic 500-DOCX first scan | 30.8248 s | Extraction-only, excludes model inference |
| Synthetic cached rescan | 1.4311 s | 500/500 cache hits; 95.36% elapsed-time reduction |
| Benchmark peak working set | 403,812,352 bytes | Measured process working set during that benchmark |
| Benchmark errors | 0 | 500 generated DOCX files |

Backend Ruff and mypy checks passed. The frontend ESLint, TypeScript check, and
production build passed in the earlier Phase 11 verification. No frontend
files were changed in the final Phase 11 hardening work.

## Interpret results carefully

The synthetic NMI and action-item scores validate the evaluation harness only;
they are not Qwen3 or embedding-model quality scores. The benchmark measures
file discovery, hashing, text extraction, persistence, and cache reuse. It
does not invoke Ollama and is not an LLM or embedding latency benchmark.

No local model inference was run for these checks. Model quality, inference
latency, and hardware-dependent memory use remain unmeasured.

## Reproduce the mock metric check

From the repository root:

```powershell
python scripts/evaluate_synthetic.py
```

The input fixture is `eval/dataset/synthetic_eval.json`. The independent
30-document demo workspace can be created with
`python scripts/generate_demo_data.py`; it is demonstration content, not
evaluation ground truth.
