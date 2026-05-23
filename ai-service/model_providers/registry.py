from __future__ import annotations

from fastapi import HTTPException

from model_providers.deepseek.client import build_client as build_deepseek_client
from model_providers.qwen.client import build_client as build_qwen_client
from model_providers.volcengine.client import build_client as build_volcengine_client
from model_providers.xunfei.client import build_client as build_xunfei_client


def get_provider_client(provider: str, config: dict[str, str]):
    normalized = provider.strip().lower()
    if normalized == "deepseek":
        return build_deepseek_client(config)
    if normalized == "qwen":
        return build_qwen_client(config)
    if normalized in {"volcengine", "huoshan"}:
        return build_volcengine_client(config)
    if normalized in {"xunfei", "iflytek"}:
        return build_xunfei_client(config)
    raise HTTPException(status_code=400, detail=f"{provider} 当前还没有独立的供应商接入文件")
