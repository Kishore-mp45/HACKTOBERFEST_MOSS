import errno
import shutil
from pathlib import Path

import pytest

from moss.filesystem import safe_move, safe_rename, sha256_file, undo_move
from moss.security.path_guard import PathGuard, SecurityError


def test_safe_move_moves_file_and_creates_destination_parent(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    source = root / "notes.txt"
    destination = root / "Archive" / "notes.txt"
    source.write_text("notes", encoding="utf-8")

    result = safe_move(source, destination, PathGuard(root))

    assert result.original == source
    assert result.final == destination
    assert not source.exists()
    assert destination.read_text(encoding="utf-8") == "notes"


def test_safe_move_generates_unique_destination_without_overwriting(
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    source = root / "incoming.txt"
    destination = root / "Archive" / "notes.txt"
    destination.parent.mkdir()
    source.write_text("incoming", encoding="utf-8")
    destination.write_text("existing", encoding="utf-8")

    result = safe_move(source, destination, PathGuard(root))

    assert result.final == destination.with_name("notes_moss_1.txt")
    assert destination.read_text(encoding="utf-8") == "existing"
    assert result.final.read_text(encoding="utf-8") == "incoming"


def test_safe_move_rejects_missing_source(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()

    with pytest.raises(FileNotFoundError, match="Source file is missing"):
        safe_move(root / "missing.txt", root / "dest.txt", PathGuard(root))


def test_safe_move_rejects_paths_outside_workspace(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    source = root / "notes.txt"
    source.write_text("notes", encoding="utf-8")

    with pytest.raises(SecurityError):
        safe_move(source, tmp_path / "outside.txt", PathGuard(root))


def test_safe_rename_is_workspace_scoped_and_conflict_safe(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    source = root / "notes.txt"
    (root / "reviewed.txt").write_text("existing", encoding="utf-8")
    source.write_text("notes", encoding="utf-8")

    result = safe_rename(source, "reviewed.txt", PathGuard(root))

    assert result.final == root / "reviewed_moss_1.txt"
    assert result.final.read_text(encoding="utf-8") == "notes"
    assert (root / "reviewed.txt").read_text(encoding="utf-8") == "existing"
    with pytest.raises(ValueError, match="filename, not a path"):
        safe_rename(result.final, "..\\outside.txt", PathGuard(root))


def test_safe_move_uses_copy_fallback_for_cross_device_errors(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    source = root / "notes.txt"
    destination = root / "Archive" / "notes.txt"
    source.write_text("notes", encoding="utf-8")

    def raise_cross_device(*_args: object, **_kwargs: object) -> None:
        raise OSError(errno.EXDEV, "cross-device link")

    monkeypatch.setattr(shutil.os, "rename", raise_cross_device)
    result = safe_move(source, destination, PathGuard(root))

    assert result.final.read_text(encoding="utf-8") == "notes"
    assert not source.exists()


def test_undo_move_restores_source_and_rejects_second_undo(
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    moved = root / "Archive" / "notes.txt"
    moved.parent.mkdir()
    moved.write_text("notes", encoding="utf-8")

    result = undo_move(root / "notes.txt", moved, PathGuard(root))

    assert result.final.read_text(encoding="utf-8") == "notes"
    with pytest.raises(FileExistsError, match="original path is occupied"):
        undo_move(root / "notes.txt", moved, PathGuard(root))


def test_undo_move_does_not_overwrite_an_occupied_original(
    tmp_path: Path,
) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    original = root / "notes.txt"
    moved = root / "Archive" / "notes.txt"
    moved.parent.mkdir()
    original.write_text("newer", encoding="utf-8")
    moved.write_text("older", encoding="utf-8")

    with pytest.raises(FileExistsError, match="original path is occupied"):
        undo_move(original, moved, PathGuard(root))

    assert original.read_text(encoding="utf-8") == "newer"
    assert moved.read_text(encoding="utf-8") == "older"


def test_undo_move_rejects_file_modified_after_execution(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    moved = root / "Archive" / "notes.txt"
    moved.parent.mkdir()
    moved.write_text("original", encoding="utf-8")
    original_hash = sha256_file(moved)
    moved.write_text("changed outside Moss", encoding="utf-8")

    with pytest.raises(ValueError, match="changed after execution"):
        undo_move(root / "notes.txt", moved, PathGuard(root), original_hash)

    assert moved.read_text(encoding="utf-8") == "changed outside Moss"
