from __future__ import annotations

import asyncio
import os
import tempfile
from dataclasses import dataclass

from fastapi import HTTPException

from model_capabilities.tts.edge_tts_adapter import synthesize_voice_to_file
from model_providers.config_store import find_provider_config
from model_providers.registry import get_provider_client
from rag.retrieval.embedder import BgeM3Embedder


@dataclass
class ModelTestResult:
    success: bool
    message: str
    detail: str | None = None


def test_model(provider: str, category: str, model_id: str, text: str | None = None) -> ModelTestResult:
    normalized_category = category.strip().lower()
    normalized_provider = provider.strip()
    normalized_model_id = model_id.strip()

    if normalized_category == "embedding":
        return test_embedding_model(normalized_provider, normalized_model_id)
    if normalized_category in {"vision", "chat", "multimodal"}:
        return test_chat_model(normalized_provider, normalized_category, normalized_model_id)
    if normalized_category == "speech":
        return test_speech_model(normalized_provider, normalized_model_id, text)

    return ModelTestResult(False, f"暂不支持测试模型分类：{category}")


def test_embedding_model(provider: str, model_id: str) -> ModelTestResult:
    if provider.lower() in {"baai", "local"}:
        try:
            vector = BgeM3Embedder(model_id).embed_query("灵山胜境模型测试")
            return ModelTestResult(True, "本地嵌入模型可用", f"返回向量维度：{len(vector)}")
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"本地嵌入模型测试失败：{exc}") from exc

    config = require_provider_config(provider)
    if get_protocol(config) != "openai_compatible":
        raise HTTPException(status_code=400, detail=f"{provider} 当前未配置可测试的 embedding 协议")
    client = get_provider_client(provider, config)
    embedding = client.test_embedding(model_id, "灵山胜境模型测试")
    return ModelTestResult(True, "Embedding 接口调用成功", f"返回向量维度：{len(embedding)}")


def test_chat_model(provider: str, category: str, model_id: str) -> ModelTestResult:
    config = require_provider_config(provider)
    if get_protocol(config) != "openai_compatible":
        raise HTTPException(status_code=400, detail=f"{provider} 当前未配置可测试的对话协议")
    client = get_provider_client(provider, config)
    content = client.test_chat_completion(model_id, category)
    detail = content[:120] if content else "模型有响应，但内容为空"
    return ModelTestResult(True, "对话接口调用成功", detail)


def test_speech_model(provider: str, model_id: str, text: str | None = None) -> ModelTestResult:
    if provider.lower() not in {"azure", "edge-tts", "edgetts"}:
        raise HTTPException(status_code=400, detail=f"{provider} 当前未接入语音测试逻辑")
    content = (text or "").strip() or "您好，欢迎来到灵山胜境，这是一段语音测试。"

    async def synthesize() -> int:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tmp_path = tmp_file.name
        try:
            return await synthesize_voice_to_file(content, model_id, tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    try:
        size = asyncio.run(synthesize())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"语音合成测试失败：{exc}") from exc
    return ModelTestResult(True, "语音合成测试成功", f"输出音频大小：{size} 字节")


def require_provider_config(provider: str) -> dict[str, str]:
    config = find_provider_config(provider)
    if config is None:
        raise HTTPException(status_code=400, detail=f"未找到 provider 配置：{provider}")
    if not str(config.get("apiKey", "")).strip():
        raise HTTPException(status_code=400, detail=f"{provider} 缺少 apiKey 配置")
    return config


def get_protocol(config: dict[str, str]) -> str:
    return str(config.get("protocol", "openai_compatible")).strip().lower()
