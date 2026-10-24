"""Markdown parser with YAML front-matter stripping."""

import re
from pathlib import Path

from moss.parsers.base_parser import BaseParser, ParseResult

_FRONT_MATTER = re.compile(r"\A---[ \t]*\r?\n.*?\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)


class MarkdownParser(BaseParser):
    def parse(self, path: Path) -> ParseResult:
        text = path.read_text(encoding="utf-8")
        text = _FRONT_MATTER.sub("", text, count=1)
        return ParseResult(
            text=text,
            word_count=len(text.split()),
            char_count=len(text),
            page_count=None,
        )
