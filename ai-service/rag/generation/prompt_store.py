from __future__ import annotations

import json
from pathlib import Path

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


class PromptConfigRequest(BaseModel):
    version: str = Field(..., min_length=1)
    system_prompt: str = Field(..., min_length=20, alias="systemPrompt")
    enabled: bool = True


def prompt_config_path() -> Path:
    return Path(__file__).resolve().parents[1] / ".runtime" / "prompt_config.json"


def load_prompt_config() -> PromptConfig:
    path = prompt_config_path()
    if not path.exists():
        return PromptConfig()
    try:
        return PromptConfig.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return PromptConfig()


def save_prompt_config(request: PromptConfigRequest) -> PromptConfig:
    config = PromptConfig(version=request.version, systemPrompt=request.system_prompt, enabled=request.enabled)
    path = prompt_config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config.model_dump(by_alias=True), ensure_ascii=False, indent=2), encoding="utf-8")
    return config
