from moss.security.filename_sanitizer import sanitize_filename


def test_replaces_unsafe_characters_and_preserves_extension() -> None:
    assert sanitize_filename("quarterly: report?.pdf") == "quarterly_ report_.pdf"


def test_strips_hidden_and_windows_incompatible_edges() -> None:
    assert sanitize_filename(".. hidden name. ") == "hidden name"


def test_uses_fallback_for_empty_name() -> None:
    assert sanitize_filename("...") == "untitled"
    assert sanitize_filename("😃.txt") == "_.txt"


def test_preserves_extension_within_length_limit() -> None:
    result = sanitize_filename(f'{"a" * 250}.pdf')

    assert result.endswith(".pdf")
    assert len(result) <= 200


def test_protects_reserved_windows_device_names() -> None:
    assert sanitize_filename("CON.txt") == "_CON.txt"
