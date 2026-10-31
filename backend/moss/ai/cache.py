"""Content-hash cache for local AI calls.

LLM classification, action extraction and cluster review are deterministic
(temperature 0) but expensive on consumer hardware. This cache stores the
raw JSON output keyed by SHA-256 of (task, model, prompt version, input),
so re-scanning an unchanged workspace — or a scheduled scan every hour —
never pays for inference twice. Embeddings already have their own
content-hash cache in the ``embeddings`` table; this covers chat calls.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any

LOGGER = logging.getLogger(__name__)


class AICache:
    """Simple in-memory JSON cache with an optional on-disk mirror."""

    def __init__(self, path: Any = None) -> None:
        self._entries: dict[str, str] = {}
        self._path = path
        if path is not None:
            self._load()

    @staticmethod
    def key(*, task: str, model: str, prompt_version: str, content: str) -> str:
        digest = hashlib.sha256()
        for part in (task, model, prompt_version, content):
            digest.update(part.encode("utf-8", errors="replace"))
            digest.update(b"\x1f")
        return digest.hexdigest()

    def get(self, key: str) -> dict[str, Any] | None:
        raw = self._entries.get(key)
        if raw is None:
            return None
        try:
            payload = json.loads(raw)
        except ValueError:
            self._entries.pop(key, None)
            return None
        return payload if isinstance(payload, dict) else None

    def put(self, key: str, payload: dict[str, Any]) -> None:
        try:
            self._entries[key] = json.dumps(payload, ensure_ascii=False)
        except (TypeError, ValueError):
            return
        if self._path is not None:
            self._save()

    def clear(self) -> int:
        count = len(self._entries)
        self._entries.clear()
        if self._path is not None:
            self._save()
        return count

    def stats(self) -> dict[str, int]:
        return {"entries": len(self._entries)}

    def _load(self) -> None:
        try:
            raw = self._path.read_text(encoding="utf-8")
            data = json.loads(raw)
            if isinstance(data, dict):
                self._entries = {
                    k: v for k, v in data.items() if isinstance(k, str) and isinstance(v, str)
                }
        except (OSError, ValueError):
            self._entries = {}

    def _save(self) -> None:
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(
                json.dumps(self._entries, ensure_ascii=False), encoding="utf-8"
            )
        except OSError:
            LOGGER.warning("Could not persist AI cache to %s", self._path)
