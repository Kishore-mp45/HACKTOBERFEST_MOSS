# Contributing

Thanks for your interest in Moss. Keep changes focused, document behavior changes, and never include private documents, local configuration, credentials, or model files in a contribution.

## Development

- Follow the setup steps in [README.md](README.md).
- Run backend checks from `backend/` with `pytest` and `ruff check .`.
- Run frontend checks from `frontend/` with `npm run lint` and `npm run build`.
- Do not add code that downloads models automatically. Moss uses only model tags that the user already has in local Ollama.
- Keep file operations reviewable, explicit, and reversible.

## Pull requests

Describe the user-visible change, list validation performed, and call out any migration or configuration impact.
