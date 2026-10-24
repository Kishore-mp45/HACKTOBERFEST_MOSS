"""DOCX parser preserving paragraph boundaries."""

from pathlib import Path

from docx import Document

from moss.parsers.base_parser import BaseParser, ParseResult


class DocxParser(BaseParser):
    def parse(self, path: Path) -> ParseResult:
        with path.open("rb") as source:
            document = Document(source)
        paragraphs = [paragraph.text for paragraph in document.paragraphs if paragraph.text]
        text = "\n".join(paragraphs)
        properties = document.core_properties
        return ParseResult(
            text=text,
            word_count=len(text.split()),
            char_count=len(text),
            page_count=None,
            metadata={
                "author": properties.author or "",
                "title": properties.title or "",
                "subject": properties.subject or "",
            },
        )
