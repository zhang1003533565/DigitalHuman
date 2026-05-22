from __future__ import annotations

from fastapi import HTTPException

from providers.deepseek import sync_models as sync_deepseek_models


def sync_provider_models(provider: str, base_url: str, api_key: str) -> list[str]:
    normalized = provider.strip().lower()
    if normalized == "deepseek":
        return sync_deepseek_models(base_url, api_key)

    raise HTTPException(status_code=400, detail=f"当前未接入 {provider} 的专属能力文件")
