from pathlib import Path

import pytest

from moss.security.path_guard import PathGuard, SecurityError


def test_accepts_paths_inside_workspace(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    nested = root / "nested"
    nested.mkdir(parents=True)
    guard = PathGuard(root)

    assert guard.validate(nested) == nested.resolve()
    assert guard.validate("nested") == nested.resolve()


def test_rejects_parent_traversal(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    guard = PathGuard(root)

    with pytest.raises(SecurityError, match="outside workspace root"):
        guard.validate(root / ".." / "outside")


def test_rejects_symlink_that_resolves_outside_workspace(tmp_path: Path) -> None:
    root = tmp_path / "workspace"
    root.mkdir()
    outside = tmp_path / "outside"
    outside.mkdir()
    link = root / "escape"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("Creating directory symlinks is not permitted on this system.")

    with pytest.raises(SecurityError, match="outside workspace root"):
        PathGuard(root).validate(link)
