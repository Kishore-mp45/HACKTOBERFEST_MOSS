"""Conservative verification for extracted natural-language date hints."""

from __future__ import annotations

import re
from datetime import UTC, datetime

from dateutil import parser
from dateutil.parser import ParserError

_NUMERIC_DATE = re.compile(r"(?<!\d)(\d{1,2})[/-](\d{1,2})[/-]\d{2,4}(?!\d)")
_ISO_DATE = re.compile(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)")


def verify_date_hint(date_hint: str | None, today: datetime | None = None) -> bool:
    if not date_hint or not date_hint.strip():
        return False

    if not _ISO_DATE.search(date_hint):
        numeric_date = _NUMERIC_DATE.search(date_hint)
        if numeric_date:
            first, second = (int(part) for part in numeric_date.groups())
            if first <= 12 and second <= 12 and first != second:
                return False

    reference = today or datetime.now(UTC)
    try:
        parser.parse(
            date_hint,
            fuzzy=True,
            default=reference.replace(tzinfo=None),
        )
    except (OverflowError, ParserError, ValueError):
        return False
    return True
