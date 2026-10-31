"""Safe, portable filename generation."""

import re
from pathlib import PurePath

_INVALID_CHARACTERS = re.compile(r"[^a-zA-Z0-9._\- ]")
_WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{number}" for number in range(1, 10)),
    *(f"LPT{number}" for number in range(1, 10)),
}
MAX_FILENAME_LENGTH = 200


def sanitize_filename(filename: str) -> str:
    raw_name = PurePath(filename).name
    suffix = PurePath(raw_name).suffix
    stem = raw_name[: -len(suffix)] if suffix else raw_name

    clean_stem = _INVALID_CHARACTERS.sub("_", stem).lstrip(". ").rstrip(". ")
    clean_suffix = _INVALID_CHARACTERS.sub("_", suffix).rstrip(". ")

    if not clean_stem:
        clean_stem = "untitled"
    if clean_stem.upper() in _WINDOWS_RESERVED_NAMES:
        clean_stem = f"_{clean_stem}"

    max_stem_length = MAX_FILENAME_LENGTH - len(clean_suffix)
    if max_stem_length < 1:
        clean_suffix = clean_suffix[-(MAX_FILENAME_LENGTH - 1) :]
        max_stem_length = 1

    return f"{clean_stem[:max_stem_length]}{clean_suffix}"
