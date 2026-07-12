from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Generator

import requests
from fastapi import HTTPException


class ProviderCallError(Exception):
    """Expected provider/network failure safe for agent degradation."""


class ProviderTimeoutError(ProviderCallError):
    pass


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

    def test_chat_completion(self, model_id: str, category: str, prompt: str | None = None) -> str:
        user_prompt = (prompt or "").strip() or f"Reply with OK for {category} model test."
        return self.chat_completion(
            model_id=model_id,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0,
        )

    def chat_completion(
        self,
        *,
        model_id: str,
        messages: list[dict[str, object]],
        temperature: float = 0.2,
        max_tokens: int | None = None,
        timeout_seconds: float = 90.0,
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
                timeout=timeout_seconds,
            )
            response.raise_for_status()
        except requests.HTTPError as exc:
            detail = extract_http_error_detail(exc.response)
            raise HTTPException(status_code=400, detail=f"对话接口测试失败：{detail}") from exc
        except requests.Timeout as exc:
            raise ProviderTimeoutError("provider request timed out") from exc
        except requests.RequestException as exc:
            raise ProviderCallError("provider request failed") from exc

        choices = response.json().get("choices") or []
        if not choices:
            raise HTTPException(status_code=400, detail="对话接口调用成功，但未返回结果")
        content = ((choices[0].get("message") or {}).get("content") or "").strip()
        return content

    def chat_completion_stream(
        self,
        *,
        model_id: str,
        messages: list[dict[str, object]],
        temperature: float = 0.2,
        max_tokens: int | None = None,
        timeout_seconds: float = 90.0,
    ) -> Generator[str, None, None]:
        payload: dict[str, object] = {
            "model": model_id,
            "temperature": temperature,
            "messages": messages,
            "stream": True,
        }
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        try:
            response = requests.post(
                self._url("/chat/completions"),
                headers=self._headers(),
                json=payload,
                timeout=timeout_seconds,
                stream=True,
            )
            response.raise_for_status()
        except requests.HTTPError as exc:
            detail = extract_http_error_detail(exc.response)
            raise HTTPException(status_code=400, detail=f"对话接口流式调用失败：{detail}") from exc
        except requests.Timeout as exc:
            raise ProviderTimeoutError("provider stream timed out") from exc
        except requests.RequestException as exc:
            raise ProviderCallError("provider stream failed") from exc

        try:
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    continue
                if line.startswith(":"):
                    continue
                if line.startswith("data:"):
                    data_str = line[len("data:"):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    token = delta.get("content") or ""
                    if token:
                        yield token
        except requests.Timeout as exc:
            raise ProviderTimeoutError("provider stream timed out") from exc
        except requests.RequestException as exc:
            raise ProviderCallError("provider stream failed") from exc
        finally:
            response.close()

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
