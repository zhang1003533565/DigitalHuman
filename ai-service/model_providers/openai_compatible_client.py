from __future__ import annotations

from dataclasses import dataclass

import requests
from fastapi import HTTPException


@dataclass
class OpenAICompatibleProviderClient:
    provider: str
    base_url: str
    api_key: str

    def test_embedding(self, model_id: str, text: str) -> list[float]:
        try:
            response = requests.post(
                self._url("/embeddings"),
                headers=self._headers(),
                json={
                    "model": model_id,
                    "input": text,
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
            raise HTTPException(status_code=400, detail="Embedding 接口调用成功，但未返回向量数据")
        return list(data[0].get("embedding") or [])

    def test_chat_completion(self, model_id: str, category: str) -> str:
        return self.chat_completion(
            model_id=model_id,
            messages=[
                {"role": "system", "content": "You are a health check assistant."},
                {"role": "user", "content": f"Reply with OK for {category} model test."},
            ],
            temperature=0,
            max_tokens=16,
        )

    def chat_completion(
        self,
        *,
        model_id: str,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        max_tokens: int | None = None,
    ) -> str:
        try:
            payload: dict[str, object] = {
                "model": model_id,
                "temperature": temperature,
                "messages": messages,
            }
            if max_tokens is not None:
                payload["max_tokens"] = max_tokens

            response = requests.post(
                self._url("/chat/completions"),
                headers=self._headers(),
                json=payload,
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
            raise HTTPException(status_code=400, detail="对话接口调用成功，但未返回结果")
        content = ((choices[0].get("message") or {}).get("content") or "").strip()
        return content

    def _url(self, path: str) -> str:
        return self.base_url.rstrip("/") + path

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
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
