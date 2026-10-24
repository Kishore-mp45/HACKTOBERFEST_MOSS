"""Plain text parser."""

from pathlib import Path

from moss.parsers.base_parser import BaseParser, ParseResult


class TextParser(BaseParser):
    def parse(self, path: Path) -> ParseResult:
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="latin-1")
        return ParseResult(
            text=text,
            word_count=len(text.split()),
            char_count=len(text),
            page_count=None,
        )
