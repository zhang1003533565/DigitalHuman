from __future__ import annotations

from dataclasses import dataclass
from typing import Generator

from model_providers.openai_compatible_client import OpenAICompatibleProviderClient


@dataclass
class DeepSeekClient:
    base: OpenAICompatibleProviderClient

    def test_embedding(self, model_id: str, text: str) -> list[float]:
        return self.base.test_embedding(model_id, text)

    def test_chat_completion(self, model_id: str, category: str) -> str:
        return self.base.test_chat_completion(model_id, category)

    def generate_answer(self, model_id: str, messages: list[dict[str, object]], temperature: float = 0.2) -> str:
        return self.base.chat_completion(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
        )

    def generate_answer_stream(self, model_id: str, messages: list[dict[str, object]], temperature: float = 0.2) -> Generator[str, None, None]:
        return self.base.chat_completion_stream(
            model_id=model_id,
            messages=messages,
            temperature=temperature,
        )


def build_client(config: dict[str, str]) -> DeepSeekClient:
    return DeepSeekClient(
        base=OpenAICompatibleProviderClient(
            provider="DeepSeek",
            base_url=config["baseUrl"],
            api_key=config["apiKey"],
        )
    )
