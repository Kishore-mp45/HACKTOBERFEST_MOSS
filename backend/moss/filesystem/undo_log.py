"""Filesystem reversal helpers for persisted execution records."""

import shutil
from pathlib import Path

from moss.filesystem.operations import MoveResult, sha256_file
from moss.security.path_guard import PathGuard


def undo_move(
    original_path: Path,
    final_path: Path,
    guard: PathGuard,
    expected_hash: str | None = None,
) -> MoveResult:
    original = guard.validate(original_path)
    final = guard.validate(final_path)
    if original.exists():
        raise FileExistsError(f"Cannot undo because the original path is occupied: {original}")
    if not final.is_file():
        raise FileNotFoundError(f"Cannot undo because the moved file is missing: {final}")
    if expected_hash is not None and sha256_file(final) != expected_hash:
        raise ValueError("Cannot undo because the moved file changed after execution.")

    original.parent.mkdir(parents=True, exist_ok=True)
    original = guard.validate(original)
    shutil.move(str(final), str(original))
    return MoveResult(original=final, final=original)
