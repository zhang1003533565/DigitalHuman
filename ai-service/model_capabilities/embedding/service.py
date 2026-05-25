from __future__ import annotations

from fastapi import HTTPException

from model_capabilities.embedding import qwen_embedding
from model_providers.config_store import find_provider_config
from model_providers.registry import get_provider_client


def embed_texts(provider: str, model_id: str, texts: list[str]) -> list[list[float]]:
    normalized_provider = provider.strip()
    if not normalized_provider:
        raise HTTPException(status_code=400, detail="Embedding provider 不能为空")
    if not model_id.strip():
        raise HTTPException(status_code=400, detail="Embedding modelId 不能为空")
    if not texts:
        return []

    if normalized_provider.lower() == "qwen":
        return qwen_embedding.embed_texts(model_id, texts)

    config = find_provider_config(normalized_provider)
    if config is None:
        raise HTTPException(status_code=400, detail=f"未找到 provider 配置：{normalized_provider}")
    if str(config.get("protocol", "openai_compatible")).strip().lower() != "openai_compatible":
        raise HTTPException(status_code=400, detail=f"{normalized_provider} 当前未配置可用的 embedding 协议")
    client = get_provider_client(normalized_provider, config)
    return [client.test_embedding(model_id, text) for text in texts]


def embed_query(provider: str, model_id: str, text: str) -> list[float]:
    return embed_texts(provider, model_id, [text])[0]
