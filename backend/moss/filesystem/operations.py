"""Validated, conflict-safe file operations."""

import shutil
from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path, PureWindowsPath

from moss.security.path_guard import PathGuard


def sha256_file(path: Path) -> str:
    digest = sha256()
    with path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


@dataclass(frozen=True)
class MoveResult:
    original: Path
    final: Path


def _unique_destination(destination: Path) -> Path:
    candidate = destination
    suffix_index = 1
    while candidate.exists():
        candidate = destination.with_name(
            f"{destination.stem}_moss_{suffix_index}{destination.suffix}"
        )
        suffix_index += 1
    return candidate


def safe_move(source: Path, dest: Path, guard: PathGuard) -> MoveResult:
    source = guard.validate(source)
    dest = guard.validate(dest)
    if not source.is_file():
        raise FileNotFoundError(f"Source file is missing: {source}")
    if source == dest:
        raise ValueError("Source and destination are the same file.")

    dest = guard.validate(_unique_destination(dest))
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest = guard.validate(dest)
    shutil.move(str(source), str(dest))
    return MoveResult(original=source, final=dest)


def safe_rename(source: Path, new_name: str, guard: PathGuard) -> MoveResult:
    windows_name = PureWindowsPath(new_name)
    if (
        not new_name
        or Path(new_name).name != new_name
        or windows_name.name != new_name
        or windows_name.is_absolute()
        or windows_name.drive
        or new_name in {".", ".."}
    ):
        raise ValueError("A rename target must be a filename, not a path.")
    source_path = guard.validate(source)
    return safe_move(source_path, source_path.with_name(new_name), guard)
