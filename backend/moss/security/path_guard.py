"""Canonical path validation for workspace-scoped access."""

from pathlib import Path


class SecurityError(ValueError):
    """Raised when a path is outside its authorized root."""


class PathGuard:
    def __init__(self, workspace_root: Path | str):
        self.root = Path(workspace_root).expanduser().resolve()
        if not self.root.is_dir():
            raise SecurityError(f"Workspace root is not an existing directory: {workspace_root!r}")

    def validate(self, path: Path | str) -> Path:
        candidate_input = Path(path).expanduser()
        if not candidate_input.is_absolute():
            candidate_input = self.root / candidate_input

        candidate = candidate_input.resolve()
        try:
            candidate.relative_to(self.root)
        except ValueError as error:
            raise SecurityError(f"Path {path!r} is outside workspace root") from error

        return candidate
