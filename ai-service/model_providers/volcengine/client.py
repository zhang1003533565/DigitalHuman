from __future__ import annotations

from fastapi import HTTPException


class VolcengineClient:
    def test_embedding(self, model_id: str, text: str) -> list[float]:
        raise HTTPException(status_code=400, detail="Volcengine provider client 还未实现")

    def test_chat_completion(self, model_id: str, category: str, prompt: str | None = None) -> str:
        raise HTTPException(status_code=400, detail="Volcengine provider client 还未实现")

    def generate_answer(self, model_id: str, messages: list[dict[str, str]], temperature: float = 0.2, timeout_seconds: float = 90.0) -> str:
        raise HTTPException(status_code=400, detail="Volcengine provider client 还未实现")

    def generate_answer_stream(self, model_id: str, messages: list[dict[str, str]], temperature: float = 0.2, timeout_seconds: float = 90.0):
        raise HTTPException(status_code=400, detail="Volcengine provider client 还未实现")


def build_client(config: dict[str, str]) -> VolcengineClient:
    return VolcengineClient()
