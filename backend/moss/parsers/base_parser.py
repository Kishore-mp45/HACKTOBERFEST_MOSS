"""Shared parser protocol and result type."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(slots=True)
class ParseResult:
    text: str
    word_count: int
    char_count: int
    page_count: int | None
    page_chunks: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    extraction_version: str = "1"
    error: str | None = None


class BaseParser(ABC):
    @abstractmethod
    def parse(self, path: Path) -> ParseResult:
        """Parse a file into normalized text and metadata."""


def parser_for_path(path: Path) -> BaseParser:
    suffix = path.suffix.casefold()
    if suffix == ".pdf":
        from moss.parsers.pdf_parser import PdfParser

        return PdfParser()
    if suffix == ".docx":
        from moss.parsers.docx_parser import DocxParser

        return DocxParser()
    if suffix in {".md", ".markdown"}:
        from moss.parsers.markdown_parser import MarkdownParser

        return MarkdownParser()
    if suffix == ".txt":
        from moss.parsers.text_parser import TextParser

        return TextParser()
    raise ValueError(f"Unsupported document extension: {suffix}")
