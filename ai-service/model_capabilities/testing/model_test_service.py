from __future__ import annotations

import asyncio
import os
import tempfile
from dataclasses import dataclass

from fastapi import HTTPException

from model_capabilities.tts.edge_tts_adapter import synthesize_voice_to_file
from model_capabilities.embedding.service import embed_query
from model_providers.registry import get_provider_client


@dataclass
class ModelTestResult:
    success: bool
    message: str
    detail: str | None = None
    caption: str | None = None
    ocr_text: str | None = None
    model_answer: str | None = None
    scene_summary: str | None = None


def test_model(provider: str, category: str, model_id: str, text: str | None = None, image_data_url: str | None = None, mode: str | None = None, base_url: str | None = None, api_key: str | None = None) -> ModelTestResult:
    normalized_category = category.strip().lower()
    normalized_provider = provider.strip()
    normalized_model_id = model_id.strip()

    if normalized_category == "embedding":
        return test_embedding_model(normalized_provider, normalized_model_id)
    if normalized_category in {"vision", "chat", "multimodal"}:
        return test_chat_model(normalized_provider, normalized_category, normalized_model_id, text, image_data_url, mode, base_url, api_key)
    if normalized_category == "speech":
        return test_speech_model(normalized_provider, normalized_model_id, text)

    return ModelTestResult(False, f"暂不支持测试模型分类：{category}")


def test_embedding_model(provider: str, model_id: str) -> ModelTestResult:
    embedding = embed_query(provider, model_id, "灵山胜境模型测试")
    return ModelTestResult(True, "Embedding 接口调用成功", f"返回向量维度：{len(embedding)}")


def test_chat_model(provider: str, category: str, model_id: str, text: str | None = None, image_data_url: str | None = None, mode: str | None = None, base_url: str | None = None, api_key: str | None = None) -> ModelTestResult:
    if not base_url or not api_key:
        raise HTTPException(status_code=400, detail=f"缺少 {provider} 的凭证信息（baseUrl/apiKey），请通过 Java 后端传入")
    config = {"provider": provider, "protocol": "openai_compatible", "baseUrl": base_url, "apiKey": api_key}

    if get_protocol(config) != "openai_compatible":
        raise HTTPException(status_code=400, detail=f"{provider} 当前未配置可测试的对话协议")
    client = get_provider_client(provider, config)
    if image_data_url:
        prompt = (text or "").strip() or f"请识别图片内容，并完成 {category} 测试。"
        content = client.generate_answer(
            model_id,
            [
                {"role": "system", "content": "You are a multimodal health check assistant."},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                },
            ],
            temperature=0,
        )
    else:
        content = client.test_chat_completion(model_id, category, text or f"Reply with OK for {category} model test.")
    detail = content[:120] if content else "模型有响应，但内容为空"
    normalized_mode = (mode or '').strip().lower()
    result = ModelTestResult(True, "对话接口调用成功", detail)
    if normalized_mode == 'caption':
        result.caption = content
    elif normalized_mode == 'ocr':
        result.ocr_text = content
    elif normalized_mode in {'qa', 'answer'}:
        result.model_answer = content
    elif normalized_mode in {'scene', 'reason'}:
        result.scene_summary = content
    else:
        result.model_answer = content
    return result


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
        raise HTTPException(status_code=400, detail="语音合成测试失败") from exc
    return ModelTestResult(True, "语音合成测试成功", f"输出音频大小：{size} 字节")




def get_protocol(config: dict[str, str]) -> str:
    return str(config.get("protocol", "openai_compatible")).strip().lower()
