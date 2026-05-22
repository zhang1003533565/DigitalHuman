from __future__ import annotations

import requests
from fastapi import HTTPException


def sync_models(base_url: str, api_key: str) -> list[str]:
    try:
        response = requests.get(
            base_url.rstrip("/") + "/models",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Accept": "application/json",
            },
            timeout=30,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="同步 DeepSeek 模型失败，请检查 API URL、Key 或网络环境") from exc

    payload = response.json()
    data = payload.get("data") or []
    model_ids = sorted({item.get("id", "").strip() for item in data if item.get("id")})
    return [model_id for model_id in model_ids if model_id]
