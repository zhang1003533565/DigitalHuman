from __future__ import annotations

from dataclasses import dataclass

from model_providers.registry import get_provider_client
from rag.contracts.schemas import ChunkRecord


@dataclass
class LlmConfig:
    provider: str | None
    base_url: str | None
    api_key: str | None
    model: str | None
    timeout_seconds: int


class ProviderBackedLlm:
    def __init__(self, config: LlmConfig) -> None:
        self.config = config

    def is_enabled(self) -> bool:
        return bool(self.config.provider and self.config.base_url and self.config.model)

    def generate_answer(self, question: str, interest: str | None, chunks: list[ChunkRecord]) -> str | None:
        if not self.is_enabled() or not chunks:
            return None

        provider_client = get_provider_client(
            self.config.provider or "",
            {
                "provider": self.config.provider or "",
                "baseUrl": self.config.base_url or "",
                "apiKey": self.config.api_key or "",
            },
        )
        prompt = build_user_prompt(question, interest, chunks)
        return provider_client.generate_answer(
            model_id=self.config.model or "",
            messages=[
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )


def infer_provider_name(base_url: str | None) -> str | None:
    if not base_url:
        return None
    normalized = base_url.lower()
    if "deepseek" in normalized:
        return "DeepSeek"
    if "openai" in normalized:
        return "OpenAI"
    if "dashscope" in normalized or "aliyuncs" in normalized:
        return "Qwen"
    return None


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
