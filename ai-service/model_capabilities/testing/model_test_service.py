from __future__ import annotations

import asyncio
import os
import tempfile
from dataclasses import dataclass

import requests
from fastapi import HTTPException

from model_capabilities.llm.openai_compatible import normalize_base_url
from model_capabilities.tts.edge_tts_adapter import synthesize_voice_to_file
from model_providers.config_store import find_provider_config
from rag.embedder import BgeM3Embedder


@dataclass
class ModelTestResult:
    success: bool
    message: str
    detail: str | None = None


def test_model(provider: str, category: str, model_id: str) -> ModelTestResult:
    normalized_category = category.strip().lower()
    normalized_provider = provider.strip()
    normalized_model_id = model_id.strip()

    if normalized_category == "embedding":
        return test_embedding_model(normalized_provider, normalized_model_id)
    if normalized_category in {"vision", "chat", "multimodal"}:
        return test_chat_model(normalized_provider, normalized_category, normalized_model_id)
    if normalized_category == "speech":
        return test_speech_model(normalized_provider, normalized_model_id)

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

    try:
        response = requests.post(
            normalize_base_url(config["baseUrl"]) + "/embeddings",
            headers=build_auth_headers(config["apiKey"]),
            json={
                "model": model_id,
                "input": "灵山胜境模型测试",
            },
            timeout=45,
        )
        response.raise_for_status()
    except requests.HTTPError as exc:
        detail = extract_http_error_detail(exc.response)
        raise HTTPException(status_code=400, detail=f"Embedding 接口测试失败：{detail}") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Embedding 接口连接失败：{exc}") from exc

    data = response.json().get("data") or []
    if not data:
        return ModelTestResult(False, "Embedding 接口调用成功，但未返回向量数据")
    embedding = data[0].get("embedding") or []
    return ModelTestResult(True, "Embedding 接口调用成功", f"返回向量维度：{len(embedding)}")


def test_chat_model(provider: str, category: str, model_id: str) -> ModelTestResult:
    config = require_provider_config(provider)
    if get_protocol(config) != "openai_compatible":
        raise HTTPException(status_code=400, detail=f"{provider} 当前未配置可测试的对话协议")

    try:
        response = requests.post(
            normalize_base_url(config["baseUrl"]) + "/chat/completions",
            headers=build_auth_headers(config["apiKey"]),
            json={
                "model": model_id,
                "temperature": 0,
                "messages": [
                    {"role": "system", "content": "You are a health check assistant."},
                    {"role": "user", "content": f"Reply with OK for {category} model test."},
                ],
                "max_tokens": 16,
            },
            timeout=45,
        )
        response.raise_for_status()
    except requests.HTTPError as exc:
        detail = extract_http_error_detail(exc.response)
        raise HTTPException(status_code=400, detail=f"对话接口测试失败：{detail}") from exc
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"对话接口连接失败：{exc}") from exc

    choices = response.json().get("choices") or []
    if not choices:
        return ModelTestResult(False, "对话接口调用成功，但未返回结果")
    content = ((choices[0].get("message") or {}).get("content") or "").strip()
    detail = content[:120] if content else "模型有响应，但内容为空"
    return ModelTestResult(True, "对话接口调用成功", detail)


def test_speech_model(provider: str, model_id: str) -> ModelTestResult:
    if provider.lower() not in {"azure", "edge-tts", "edgetts"}:
        raise HTTPException(status_code=400, detail=f"{provider} 当前未接入语音测试逻辑")

    async def synthesize() -> int:
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_file:
            tmp_path = tmp_file.name
        try:
            return await synthesize_voice_to_file("灵山胜境语音测试", model_id, tmp_path)
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


def build_auth_headers(api_key: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def extract_http_error_detail(response: requests.Response | None) -> str:
    if response is None:
        return "上游接口未返回响应"
    try:
        payload = response.json()
        error = payload.get("error")
        if isinstance(error, dict):
            return str(error.get("message") or error)
        if error:
            return str(error)
        detail = payload.get("detail")
        if detail:
            return str(detail)
    except Exception:
        pass
    return f"HTTP {response.status_code}: {response.text[:200]}"
