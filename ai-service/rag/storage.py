from __future__ import annotations

from pathlib import Path
import shutil


ALLOWED_SUFFIXES = {".docx", ".pdf", ".txt"}


def ensure_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def is_supported_file_name(file_name: str) -> bool:
    return Path(file_name).suffix.lower() in ALLOWED_SUFFIXES


def save_uploaded_file(target_dir: Path, file_name: str, file_obj) -> Path:
    ensure_directory(target_dir)
    target_path = target_dir / sanitize_file_name(file_name)
    with target_path.open("wb") as output:
        shutil.copyfileobj(file_obj, output)
    return target_path


def sanitize_file_name(file_name: str) -> str:
    name = Path(file_name).name.strip()
    return name or "uploaded_document.txt"
