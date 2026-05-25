from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, UTC
from pathlib import Path
import hashlib
import re
import uuid

from rag.contracts.schemas import ChunkPayload, ChunkRecord
from rag.ingestion.parser import ParsedElement


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

    def add_chunk(text: str, next_content_type: str, spot_name: str | None = None, extra_tags: list[str] | None = None) -> None:
        nonlocal chunk_index
        piece = text.strip()
        if not piece:
            return
        payload = ChunkPayload(
            doc_id=doc_id,
            source_file=path.name,
            title=title,
            section_path=section_stack.copy(),
            chunk_index=chunk_index,
            tags=extract_tags(section_stack + (extra_tags or []), piece),
            spot_name=spot_name or extract_spot_name(section_stack, piece),
            content_type=next_content_type,
            updated_at=updated_at,
            quality_flags=detect_quality_flags(piece),
        )
        chunks.append(
            ChunkRecord(
                id=stable_chunk_id(doc_id, chunk_index),
                text=piece,
                payload=payload,
            )
        )
        chunk_index += 1

    def flush() -> None:
        nonlocal buffer
        text = " ".join(buffer).strip()
        if not text:
            buffer = []
            return

        for piece in split_text(text, config.chunk_size, config.chunk_overlap):
            add_chunk(piece, content_type)
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
            for table_chunk in build_table_chunks(element.text):
                add_chunk(
                    table_chunk.text,
                    "table",
                    spot_name=table_chunk.spot_name,
                    extra_tags=table_chunk.tags,
                )
            content_type = "paragraph"
            continue

        if is_section_marker(element.text):
            flush()
            section_stack[:] = [title, element.text]
            content_type = "paragraph"
            continue

        content_type = element.content_type
        buffer.append(element.text)
        if len(" ".join(buffer)) >= config.chunk_size:
            flush()

    flush()
    return chunks


@dataclass
class TableChunk:
    text: str
    spot_name: str | None = None
    tags: list[str] | None = None


def build_table_chunks(text: str) -> list[TableChunk]:
    rows = [row.strip() for row in text.splitlines() if row.strip()]
    if not rows:
        return []
    header = split_table_row(rows[0])
    if is_spot_table_header(header):
        return build_spot_table_chunks(header, rows[1:])
    return [TableChunk(piece) for piece in split_text(text, 900, 120)]


def build_spot_table_chunks(header: list[str], rows: list[str]) -> list[TableChunk]:
    chunks: list[TableChunk] = []
    current_scenic_area = ""
    for row in rows:
        values = split_table_row(row)
        if len(values) < 3:
            continue
        record = dict(zip(header, values))
        scenic_area = record.get("景区名称") or current_scenic_area
        spot_id = record.get("景点ID") or record.get("景点 ID") or ""
        spot_name = record.get("景点名称") or extract_spot_name([], row)
        if scenic_area:
            current_scenic_area = scenic_area
        if not spot_id and not spot_name:
            continue
        tags = [value for value in [scenic_area, spot_id, spot_name, record.get("核心功能"), record.get("文化内涵")] if value]
        for text in format_spot_record_chunks(header, record):
            chunks.append(TableChunk(text=text, spot_name=spot_name, tags=tags))
    return chunks


def split_table_row(row: str) -> list[str]:
    return [cell.strip() for cell in row.split("|")]


def is_spot_table_header(header: list[str]) -> bool:
    normalized = {cell.replace(" ", "") for cell in header}
    return {"景区名称", "景点ID", "景点名称"}.issubset(normalized)


def format_spot_record(header: list[str], record: dict[str, str]) -> str:
    lines = []
    for key in header:
        value = record.get(key, "").strip()
        if value:
            lines.append(f"{key}：{value}")
    return "\n".join(lines)


def format_spot_record_chunks(header: list[str], record: dict[str, str]) -> list[str]:
    full_text = format_spot_record(header, record)
    if len(full_text) <= 900:
        return [full_text]

    base_keys = ["景区名称", "景点ID", "景点名称"]
    base_lines = format_selected_fields(base_keys, record)
    field_groups = [
        ("概览", ["具体位置", "建筑/景观参数", "核心功能", "文化内涵"]),
        ("详细介绍", ["详细介绍"]),
        ("游玩信息", ["游玩亮点", "演艺/开放信息", "备注"]),
    ]
    chunks: list[str] = []
    for label, keys in field_groups:
        body_lines = format_selected_fields(keys, record)
        if not body_lines:
            continue
        body = "\n".join(body_lines)
        prefix = "\n".join([*base_lines, f"知识块类型：{label}"])
        available_size = max(320, 900 - len(prefix) - 1)
        for piece in split_text(body, available_size, 0):
            chunks.append(f"{prefix}\n{piece}")
    return chunks or [full_text]


def format_selected_fields(keys: list[str], record: dict[str, str]) -> list[str]:
    lines = []
    for key in keys:
        value = record.get(key, "").strip()
        if value:
            lines.append(f"{key}：{value}")
    return lines


def is_section_marker(text: str) -> bool:
    return bool(re.match(r"^(子?表\d+|表\d+)[：:]", text.strip()))


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


def stable_chunk_id(doc_id: str, chunk_index: int) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"digitalhuman-rag:{doc_id}:{chunk_index}"))


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


def detect_quality_flags(text: str) -> list[str]:
    flags: list[str] = []
    normalized = text.strip()
    if not normalized:
        flags.append("empty")
    if 0 < len(normalized) < 40:
        flags.append("too_short")
    if len(normalized) > 900:
        flags.append("too_long")
    if len(normalized) > 20 and len(set(normalized)) < max(8, len(normalized) // 12):
        flags.append("low_information")
    return flags
