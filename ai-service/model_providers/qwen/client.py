from __future__ import annotations

from dataclasses import dataclass
from typing import Generator

from model_providers.openai_compatible_client import OpenAICompatibleProviderClient


@dataclass
class QwenClient:
    base: OpenAICompatibleProviderClient

    def test_embedding(self, model_id: str, text: str) -> list[float]:
        return self.base.test_embedding(model_id, text)

    def test_chat_completion(self, model_id: str, category: str, prompt: str | None = None) -> str:
        return self.base.test_chat_completion(model_id, category, prompt)

    def generate_answer(self, model_id: str, messages: list[dict[str, object]], temperature: float = 0.2, timeout_seconds: float = 90.0) -> str:
        return self.base.chat_completion(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
            timeout_seconds=timeout_seconds,
        )

    def generate_answer_stream(self, model_id: str, messages: list[dict[str, object]], temperature: float = 0.2, timeout_seconds: float = 90.0) -> Generator[str, None, None]:
        return self.base.chat_completion_stream(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
            timeout_seconds=timeout_seconds,
        )


def build_client(config: dict[str, str]) -> QwenClient:
    return QwenClient(
        base=OpenAICompatibleProviderClient(
            provider="Qwen",
            base_url=config["baseUrl"],
            api_key=config["apiKey"],
        )
    )
