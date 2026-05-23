from __future__ import annotations

from fastapi import HTTPException

from model_providers.deepseek.client import build_client as build_deepseek_client
from model_providers.openai.client import build_client as build_openai_client
from model_providers.qwen.client import build_client as build_qwen_client


def get_provider_client(provider: str, config: dict[str, str]):
    normalized = provider.strip().lower()
    if normalized == "deepseek":
        return build_deepseek_client(config)
    if normalized == "openai":
        return build_openai_client(config)
    if normalized == "qwen":
        return build_qwen_client(config)
    raise HTTPException(status_code=400, detail=f"{provider} 当前还没有独立的供应商接入文件")
