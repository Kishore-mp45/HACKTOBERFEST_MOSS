"""Runtime-tunable settings persisted in the database.

The static :class:`moss.config.Settings` (TOML + env) provides defaults;
this module layers user-editable overrides on top so the Settings UI can
change AI behaviour, thresholds and scheduled scans without a restart.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from moss.models import SettingsRow

LOGGER = logging.getLogger(__name__)

#: Keys the Settings UI is allowed to write, with their validation rules.
#: ``("type", low, high)`` for numbers, ``"bool"`` for flags.
EDITABLE_KEYS: dict[str, tuple[str, Any, Any]] = {
    "similarity_threshold": ("float", 0.3, 0.99),
    "duplicate_threshold": ("float", 0.5, 1.0),
    "enable_llm_clustering": ("bool", None, None),
    "llm_max_concurrency": ("int", 1, 8),
    "ai_cache_enabled": ("bool", None, None),
    "auto_scan_enabled": ("bool", None, None),
    "auto_scan_interval_minutes": ("int", 5, 1440),
}


def _coerce(key: str, value: Any) -> Any:
    kind, low, high = EDITABLE_KEYS[key]
    if kind == "bool":
        if not isinstance(value, bool):
            raise ValueError(f"{key} must be a boolean.")
        return value
    if kind == "int":
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{key} must be an integer between {low} and {high}.")
        if not low <= value <= high:
            raise ValueError(f"{key} must be between {low} and {high}.")
        return value
    if kind == "float":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{key} must be a number between {low} and {high}.")
        if not float(low) <= float(value) <= float(high):
            raise ValueError(f"{key} must be between {low} and {high}.")
        return float(value)
    raise ValueError(f"Unknown setting kind {kind}")


async def load_runtime_overrides(session: AsyncSession) -> dict[str, Any]:
    """Return all persisted overrides as a plain dict."""
    result = await session.execute(select(SettingsRow))
    overrides: dict[str, Any] = {}
    for row in result.scalars():
        value = row.value.get("value") if isinstance(row.value, dict) else None
        if value is None:
            continue
        try:
            overrides[row.key] = _coerce(row.key, value)
        except ValueError:
            LOGGER.warning("Ignoring invalid persisted setting %s", row.key)
    return overrides


async def apply_runtime_settings(
    session: AsyncSession, updates: dict[str, Any]
) -> dict[str, Any]:
    """Validate and persist setting updates; returns the stored overrides."""
    unknown = sorted(set(updates) - set(EDITABLE_KEYS))
    if unknown:
        raise ValueError(f"Unsupported setting keys: {', '.join(unknown)}")
    for key, raw in updates.items():
        value = _coerce(key, raw)
        row = await session.get(SettingsRow, key)
        payload = {"value": value}
        if row is None:
            session.add(SettingsRow(key=key, value=payload))
        else:
            row.value = payload
    await session.commit()
    return await load_runtime_overrides(session)


def effective_settings(base: Any, overrides: dict[str, Any]) -> dict[str, Any]:
    """Merge DB overrides over the static config for API responses."""
    merged: dict[str, Any] = {}
    for key in EDITABLE_KEYS:
        merged[key] = getattr(base, key, None)
        if key in overrides:
            merged[key] = overrides[key]
    return merged
