from __future__ import annotations

import json
from pathlib import Path

from datetime import datetime

from pydantic import BaseModel, Field


DEFAULT_PROMPT_VERSION = "rag-grounded-v1"
DEFAULT_SYSTEM_PROMPT = (
    "你是景区知识库问答助手。"
    "只能依据提供的知识库片段回答，不允许补充片段中没有的信息。"
    "如果信息不足，明确说知识库暂未覆盖。"
    "回答使用简洁中文，优先给出直接结论，再补充要点。"
    "如果引用来源，请用“来源：文件名 / 标题”这种格式。"
)


class PromptConfig(BaseModel):
    version: str = DEFAULT_PROMPT_VERSION
    system_prompt: str = Field(default=DEFAULT_SYSTEM_PROMPT, alias="systemPrompt")
    enabled: bool = True
    created_at: str | None = Field(default=None, alias="createdAt")
    status: str = "ACTIVE"


class PromptConfigRequest(BaseModel):
    version: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=20, alias="systemPrompt")
    enabled: bool = True


class PromptVersionSummary(BaseModel):
    version: str
    enabled: bool
    status: str
    created_at: str | None = Field(default=None, alias="createdAt")


def prompt_config_path() -> Path:
    return Path(__file__).resolve().parents[1] / ".runtime" / "prompt_config.json"


def prompt_versions_path() -> Path:
    return Path(__file__).resolve().parents[1] / ".runtime" / "prompt_versions.json"


def load_prompt_config() -> PromptConfig:
    path = prompt_config_path()
    if not path.exists():
        return PromptConfig()
    try:
        return PromptConfig.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return PromptConfig()


def save_prompt_config(request: PromptConfigRequest) -> PromptConfig:
    config = PromptConfig(
        version=request.version,
        systemPrompt=request.system_prompt,
        enabled=request.enabled,
        createdAt=datetime.now().isoformat(timespec="seconds"),
        status="ACTIVE" if request.enabled else "DRAFT",
    )
    path = prompt_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config.model_dump(by_alias=True), ensure_ascii=False, indent=2), encoding="utf-8")
    upsert_prompt_version(config)
    return config


def load_prompt_versions() -> list[PromptConfig]:
    path = prompt_versions_path()
    versions: list[PromptConfig] = []
    if path.exists():
        try:
            raw_items = json.loads(path.read_text(encoding="utf-8"))
            versions = [PromptConfig.model_validate(item) for item in raw_items if isinstance(item, dict)]
        except Exception:
            versions = []
    current = load_prompt_config()
    if not any(item.version == current.version for item in versions):
        versions.insert(0, current)
    return sorted(versions, key=lambda item: item.created_at or "", reverse=True)


def upsert_prompt_version(config: PromptConfig) -> None:
    versions = [item for item in load_prompt_versions() if item.version != config.version]
    if config.enabled:
        versions = [
            item.model_copy(update={"enabled": False, "status": "ROLLED_BACK" if item.status == "ACTIVE" else item.status})
            for item in versions
        ]
    versions.insert(0, config)
    path = prompt_versions_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([item.model_dump(by_alias=True) for item in versions], ensure_ascii=False, indent=2), encoding="utf-8")


def publish_prompt_version(version: str) -> PromptConfig:
    versions = load_prompt_versions()
    target = next((item for item in versions if item.version == version), None)
    if not target:
        raise ValueError("Prompt 版本不存在")
    active = target.model_copy(update={"enabled": True, "status": "ACTIVE"})
    path = prompt_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(active.model_dump(by_alias=True), ensure_ascii=False, indent=2), encoding="utf-8")
    upsert_prompt_version(active)
    return active
