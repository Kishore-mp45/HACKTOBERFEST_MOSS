#!/usr/bin/env sh
set -eu

command -v python3 >/dev/null 2>&1 || { echo "python3 is required" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required" >&2; exit 1; }
command -v ollama >/dev/null 2>&1 || { echo "ollama is required" >&2; exit 1; }

echo "Checking existing Ollama model inventory without pulling or running models..."
models="$(ollama list)"
printf '%s\n' "$models" | grep -Fq 'qwen3:4b' || echo "Warning: qwen3:4b is not listed; no model was downloaded." >&2
printf '%s\n' "$models" | grep -Fq 'nomic-embed-text:latest' || echo "Warning: nomic-embed-text:latest is not listed; no model was downloaded." >&2
echo "Prerequisite check complete. This script does not install packages or download models."
