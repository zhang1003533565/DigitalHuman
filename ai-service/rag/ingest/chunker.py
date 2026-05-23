from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
import hashlib
import re

from rag.core.schemas import ChunkPayload, ChunkRecord
from rag.ingest.parser import ParsedElement


@dataclass
class ChunkingConfig:
    chunk_size: int
    chunk_overlap: int


def build_chunks(path: Path, elements: list[ParsedElement], config: ChunkingConfig) -> list[ChunkRecord]:
    title = path.stem
    section_stack: list[str] = [title]
    buffer: list[str] = []
    chunks: list[ChunkRecord] = []
    content_type = "paragraph"
    doc_id = stable_doc_id(path)
    chunk_index = 0
    updated_at = datetime.now(UTC).isoformat()

    def flush() -> None:
        nonlocal buffer, chunk_index
        text = " ".join(buffer).strip()
        if not text:
            buffer = []
            return

        for piece in split_text(text, config.chunk_size, config.chunk_overlap):
            payload = ChunkPayload(
                doc_id=doc_id,
                source_file=path.name,
                title=title,
                section_path=section_stack.copy(),
                chunk_index=chunk_index,
                tags=extract_tags(section_stack, piece),
                spot_name=extract_spot_name(section_stack, piece),
                content_type=content_type,
                updated_at=updated_at,
            )
            chunks.append(
                ChunkRecord(
                    id=f"{doc_id}-{chunk_index}",
                    text=piece,
                    payload=payload,
                )
            )
            chunk_index += 1
        buffer = []

    for element in elements:
        if element.content_type == "heading":
            flush()
            if element.heading_level is not None:
                target_size = max(1, element.heading_level)
                section_stack[:] = section_stack[:target_size]
                if len(section_stack) < target_size:
                    while len(section_stack) < target_size:
                        section_stack.append("")
                section_stack[target_size - 1] = element.text
                section_stack[:] = [item for item in section_stack if item]
            else:
                section_stack = [title, element.text]
            content_type = "paragraph"
            continue

        if element.content_type == "table":
            flush()
            content_type = "table"
            buffer = [element.text]
            flush()
            content_type = "paragraph"
            continue

        content_type = element.content_type
        buffer.append(element.text)
        if len(" ".join(buffer)) >= config.chunk_size:
            flush()

    flush()
    return chunks


def split_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    if len(text) <= chunk_size:
        return [text]

    segments: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        if end < len(text):
            split_at = max(text.rfind("。", start, end), text.rfind("；", start, end), text.rfind("\n", start, end))
            if split_at > start + 50:
                end = split_at + 1
        segment = text[start:end].strip()
        if segment:
            segments.append(segment)
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return segments


def stable_doc_id(path: Path) -> str:
    return hashlib.md5(str(path).encode("utf-8")).hexdigest()


def extract_tags(section_stack: list[str], text: str) -> list[str]:
    values = section_stack + re.findall(r"[一-龥]{2,8}", text[:80])
    seen: list[str] = []
    for value in values:
        candidate = value.strip()
        if len(candidate) < 2 or candidate in seen:
            continue
        seen.append(candidate)
        if len(seen) >= 8:
            break
    return seen


def extract_spot_name(section_stack: list[str], text: str) -> str | None:
    for value in reversed(section_stack):
        if 2 <= len(value) <= 12:
            return value
    match = re.search(r"[一-龥]{2,8}", text)
    return match.group(0) if match else None
