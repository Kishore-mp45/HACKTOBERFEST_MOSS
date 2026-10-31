"""PDF text extraction using pypdf."""

from pathlib import Path

from pypdf import PdfReader

from moss.parsers.base_parser import BaseParser, ParseResult


class PdfParser(BaseParser):
    def parse(self, path: Path) -> ParseResult:
        reader = PdfReader(path, strict=False)
        chunks: list[dict[str, object]] = []
        errors: list[str] = []

        for page_number, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as error:
                errors.append(f"Page {page_number}: {type(error).__name__}")
                text = ""
            chunks.append({"page": page_number, "text": text})

        full_text = "\n".join(str(chunk["text"]) for chunk in chunks)
        metadata = reader.metadata
        return ParseResult(
            text=full_text,
            word_count=len(full_text.split()),
            char_count=len(full_text),
            page_count=len(reader.pages),
            page_chunks=chunks,
            metadata={
                "author": str(metadata.author or "") if metadata else "",
                "title": str(metadata.title or "") if metadata else "",
            },
            error="; ".join(errors) if errors else None,
        )
