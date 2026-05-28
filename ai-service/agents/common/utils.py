from __future__ import annotations

import re
from pathlib import Path


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return str(value).strip()


def is_empty_row(values: list[str]) -> bool:
    return all(not normalize_text(v) for v in values)


def sanitize_id(text: str) -> str:
    cleaned = re.sub(r"\s+", "-", normalize_text(text))
    cleaned = re.sub(r"[^\w\-\u4e00-\u9fa5]", "", cleaned)
    return cleaned[:64] if cleaned else "unknown"


def under_kb_dir(path: Path, kb_dir: Path) -> bool:
    try:
        path.resolve().relative_to(kb_dir.resolve())
        return True
    except Exception:
        return False
