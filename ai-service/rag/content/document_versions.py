from __future__ import annotations

import difflib
import json
import shutil
import time
from pathlib import Path


def versions_root() -> Path:
    return Path(__file__).resolve().parents[1] / ".runtime" / "document_versions"


def safe_dir_name(file_name: str) -> str:
    return file_name.replace("/", "_").replace("\\", "_")


def version_dir(file_name: str) -> Path:
    return versions_root() / safe_dir_name(file_name)


def record_document_version(path: Path, actor: str = "admin") -> dict[str, object]:
    target_dir = version_dir(path.name)
    target_dir.mkdir(parents=True, exist_ok=True)
    version = str(int(time.time() * 1000))
    copied_path = target_dir / f"{version}{path.suffix.lower()}"
    shutil.copy2(path, copied_path)
    metadata = {
        "version": version,
        "fileName": path.name,
        "storedName": copied_path.name,
        "sizeBytes": path.stat().st_size,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "actor": actor,
    }
    (target_dir / f"{version}.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    return metadata


def list_document_versions(file_name: str) -> list[dict[str, object]]:
    target_dir = version_dir(file_name)
    if not target_dir.exists():
        return []
    items = []
    for metadata_path in target_dir.glob("*.json"):
        try:
            items.append(json.loads(metadata_path.read_text(encoding="utf-8")))
        except Exception:
            continue
    return sorted(items, key=lambda item: str(item.get("version", "")), reverse=True)


def restore_document_version(file_name: str, version: str, knowledge_base_dir: Path) -> dict[str, object]:
    versions = list_document_versions(file_name)
    metadata = next((item for item in versions if str(item.get("version")) == version), None)
    if not metadata:
        raise FileNotFoundError("文档版本不存在")
    source = version_dir(file_name) / str(metadata.get("storedName"))
    if not source.exists():
        raise FileNotFoundError("文档版本文件不存在")
    knowledge_base_dir.mkdir(parents=True, exist_ok=True)
    target = knowledge_base_dir / file_name
    shutil.copy2(source, target)
    return record_document_version(target, actor="restore")


def diff_versions(file_name: str, left_text: str, right_text: str) -> list[str]:
    return list(difflib.unified_diff(
        left_text.splitlines(),
        right_text.splitlines(),
        fromfile=f"{file_name}:previous",
        tofile=f"{file_name}:current",
        lineterm="",
    ))[:200]
