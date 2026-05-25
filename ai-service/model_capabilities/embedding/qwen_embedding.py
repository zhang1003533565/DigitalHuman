from __future__ import annotations

from fastapi import HTTPException

from model_providers.config_store import find_provider_config
from model_providers.qwen.client import build_client


def embed_texts(model_id: str, texts: list[str]) -> list[list[float]]:
    config = find_provider_config("Qwen")
    if config is None:
        raise HTTPException(status_code=400, detail="未找到 Qwen provider 配置")
    if not str(config.get("apiKey", "")).strip():
        raise HTTPException(status_code=400, detail="Qwen 缺少 apiKey 配置")

    client = build_client(config)
    return [client.test_embedding(model_id, text) for text in texts]
