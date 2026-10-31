# Local Model Setup

Moss uses the Ollama service already running on this machine. It expects:

| Role | Ollama tag |
|---|---|
| Text generation and structured extraction | `Qwen3:4b` |
| Document embeddings | `nomic-embed-text:latest` |

Moss does not run `ollama pull`, download model files, install replacements,
or send document contents to a cloud model.

## Verify the local runtime

In a terminal, check that the Ollama command is available and the service
responds:

```powershell
ollama --version
ollama list
```

Confirm that the model list includes both required tags, with matching
spelling and tag suffixes. On macOS or Linux, use the same commands in a
terminal.

If Ollama is not running, start the Ollama application or its local service
using the installation method already configured on your machine. Do not
install or pull models as part of this setup.

## Configure Moss

The checked-in defaults are in `backend/config.example.toml`. To override
them, copy it to the ignored local file `backend/config.toml`. The runtime
must be reachable at `http://localhost:11434` (or another loopback URL
configured as `ollama_base_url`).

Keep the generation and embedding roles separate. The model tag for each
role must already be present in the local Ollama inventory. The defaults are
the user's chosen existing models; any replacement must also be preinstalled
and compatible with the corresponding task.

## Check model status

Start the backend, then open `http://127.0.0.1:8765/api/health/model-status`
or view the model status in the application. This endpoint checks Ollama
availability and the configured model tags; it does **not** run inference,
download a model, or measure model quality.

If a configured tag is missing, check its exact spelling in `ollama list`
and update the local Moss configuration to a compatible model tag that is
already installed. A scan that requires an unavailable model reports an
error instead of silently returning fabricated analysis.

For issues, see [Troubleshooting](troubleshooting.md).
