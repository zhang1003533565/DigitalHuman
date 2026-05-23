from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import re

import pdfplumber
from docx import Document
from docx.document import Document as DocxDocument
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table, _Cell
from docx.text.paragraph import Paragraph


@dataclass
class ParsedElement:
    text: str
    content_type: str
    heading_level: int | None = None


def parse_document(path: Path) -> list[ParsedElement]:
    suffix = path.suffix.lower()
    if suffix == ".docx":
        return parse_docx(path)
    if suffix == ".pdf":
        return parse_pdf(path)
    if suffix == ".txt":
        return parse_txt(path)
    raise ValueError(f"Unsupported file type: {path.suffix}")


def parse_txt(path: Path) -> list[ParsedElement]:
    content = path.read_text(encoding="utf-8", errors="ignore")
    return [
        ParsedElement(text=line.strip(), content_type="paragraph")
        for line in content.splitlines()
        if line.strip()
    ]


def parse_pdf(path: Path) -> list[ParsedElement]:
    elements: list[ParsedElement] = []
    with pdfplumber.open(path) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            for line in text.splitlines():
                cleaned = normalize_text(line)
                if not cleaned:
                    continue
                elements.append(
                    ParsedElement(
                        text=cleaned,
                        content_type="paragraph" if len(cleaned) > 25 else "heading",
                        heading_level=1 if len(cleaned) <= 25 else None,
                    )
                )
            for table in page.extract_tables() or []:
                rows = []
                for row in table:
                    values = [normalize_text(cell or "") for cell in row if normalize_text(cell or "")]
                    if values:
                        rows.append(" | ".join(values))
                if rows:
                    elements.append(
                        ParsedElement(
                            text=f"第{page_index}页表格：\n" + "\n".join(rows),
                            content_type="table",
                        )
                    )
    return elements


def parse_docx(path: Path) -> list[ParsedElement]:
    document = Document(path)
    elements: list[ParsedElement] = []
    for block in iter_block_items(document):
        if isinstance(block, Paragraph):
            text = normalize_text(block.text)
            if not text:
                continue
            style_name = block.style.name if block.style else ""
            heading_level = parse_heading_level(style_name)
            elements.append(
                ParsedElement(
                    text=text,
                    content_type="heading" if heading_level else "paragraph",
                    heading_level=heading_level,
                )
            )
        elif isinstance(block, Table):
            rows = []
            for row in block.rows:
                values = [normalize_text(cell.text) for cell in row.cells if normalize_text(cell.text)]
                if values:
                    rows.append(" | ".join(values))
            if rows:
                elements.append(ParsedElement(text="\n".join(rows), content_type="table"))
    return elements


def iter_block_items(parent: DocxDocument | _Cell) -> Iterable[Paragraph | Table]:
    parent_elm = parent.element.body if isinstance(parent, DocxDocument) else parent._tc
    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)


def parse_heading_level(style_name: str) -> int | None:
    match = re.search(r"heading\s*(\d+)", style_name, flags=re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()
