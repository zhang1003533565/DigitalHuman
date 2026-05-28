from __future__ import annotations

from dataclasses import dataclass

from model_providers.registry import get_provider_client
from model_providers.config_store import find_provider_config
from rag.contracts.schemas import ChunkRecord
from rag.generation.prompt_store import DEFAULT_SYSTEM_PROMPT, DEFAULT_PROMPT_VERSION, load_prompt_config
from rag.provider_runtime import check_provider_quota, log_provider_call


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

        return self.generate_messages(
            [
                {"role": "system", "content": build_system_prompt()},
                {"role": "user", "content": build_user_prompt(question, interest, chunks)},
            ],
            temperature=0.2,
        )

    def generate_messages(self, messages: list[dict[str, object]], temperature: float = 0.2) -> str | None:
        if not self.is_enabled():
            return None

        candidates = self._provider_candidates()
        last_error: Exception | None = None
        for candidate in candidates:
            provider = candidate["provider"]
            provider_client = get_provider_client(provider, candidate)
            for _ in range(2):
                try:
                    check_provider_quota(provider)
                    answer = provider_client.generate_answer(
                        model_id=self.config.model or "",
                        messages=messages,
                        temperature=temperature,
                    )
                    log_provider_call(provider, self.config.model or "", True)
                    return answer
                except Exception as exc:
                    last_error = exc
                    log_provider_call(provider, self.config.model or "", False, str(exc))
        if last_error:
            raise last_error
        return None

    def _provider_candidates(self) -> list[dict[str, str]]:
        provider = (self.config.provider or "").strip()
        if not provider:
            return []

        db_config = find_provider_config(provider)
        if not db_config:
            raise RuntimeError(f"provider_not_configured:{provider}")

        return [{
            "provider": provider,
            "baseUrl": str(db_config.get("baseUrl", "")).strip(),
            "apiKey": str(db_config.get("apiKey", "")).strip(),
        }]

    def rewrite_question(self, question: str, history: list[dict[str, str]], interest: str | None) -> str | None:
        if not self.is_enabled() or not history:
            return None
        history_text = "\n".join(f"{item['role']}：{item['content']}" for item in history[-6:])
        interest_line = f"\n用户兴趣：{interest}" if interest else ""
        rewritten = self.generate_messages(
            [
                {"role": "system", "content": "你负责把多轮对话中的用户问题改写成适合知识库检索的单句中文查询。只输出改写后的查询。"},
                {"role": "user", "content": f"历史对话：\n{history_text}{interest_line}\n\n当前问题：{question}\n\n请输出检索查询："},
            ],
            temperature=0,
        )
        return rewritten.strip() if rewritten else None


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
    config = load_prompt_config()
    prompt = config.system_prompt if config.enabled else DEFAULT_SYSTEM_PROMPT
    return (
        f"Prompt版本：{get_prompt_version()}。"
        + prompt
    )


def get_prompt_version() -> str:
    config = load_prompt_config()
    return config.version if config.enabled else DEFAULT_PROMPT_VERSION


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
