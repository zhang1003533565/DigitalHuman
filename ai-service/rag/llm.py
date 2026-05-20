from __future__ import annotations

from dataclasses import dataclass
import json

import requests

from rag.schemas import ChunkRecord


@dataclass
class LlmConfig:
    base_url: str | None
    api_key: str | None
    model: str | None
    timeout_seconds: int


class OpenAICompatibleLlm:
    def __init__(self, config: LlmConfig) -> None:
        self.config = config

    def is_enabled(self) -> bool:
        return bool(self.config.base_url and self.config.model)

    def generate_answer(self, question: str, interest: str | None, chunks: list[ChunkRecord]) -> str | None:
        if not self.is_enabled() or not chunks:
            return None

        prompt = build_user_prompt(question, interest, chunks)
        payload = {
            "model": self.config.model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": prompt},
            ],
        }

        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"

        response = requests.post(
            normalize_base_url(self.config.base_url) + "/chat/completions",
            headers=headers,
            data=json.dumps(payload),
            timeout=self.config.timeout_seconds,
        )
        response.raise_for_status()
        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            return None
        message = choices[0].get("message") or {}
        content = message.get("content")
        return content.strip() if isinstance(content, str) and content.strip() else None


def normalize_base_url(base_url: str | None) -> str:
    if not base_url:
        return ""
    return base_url.rstrip("/")


def build_system_prompt() -> str:
    return (
        "你是景区知识库问答助手。"
        "只能依据提供的知识库片段回答，不允许补充片段中没有的信息。"
        "如果信息不足，明确说知识库暂未覆盖。"
        "回答使用简洁中文，优先给出直接结论，再补充要点。"
        "如果引用来源，请用“来源：文件名 / 标题”这种格式。"
    )


def build_user_prompt(question: str, interest: str | None, chunks: list[ChunkRecord]) -> str:
    context_blocks = []
    for index, chunk in enumerate(chunks, start=1):
        section = " / ".join(chunk.payload.section_path) if chunk.payload.section_path else chunk.payload.title
        context_blocks.append(
            f"[片段{index}]\n"
            f"来源文件：{chunk.payload.source_file}\n"
            f"标题路径：{section}\n"
            f"内容：{chunk.text}\n"
        )

    interest_line = f"\n用户兴趣偏好：{interest}" if interest else ""
    return (
        f"用户问题：{question}{interest_line}\n\n"
        "以下是检索到的知识库片段，请严格基于这些内容作答：\n\n"
        + "\n".join(context_blocks)
        + "\n请输出：\n"
        + "1. 一个自然、直接的中文回答\n"
        + "2. 如果知识不足，明确说明\n"
        + "3. 末尾附上 1-3 条来源，格式为“来源：文件名 / 标题路径”"
    )
