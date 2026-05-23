from __future__ import annotations

import json
from pathlib import Path


AI_SERVICE_ROOT = Path(__file__).resolve().parent
LOCAL_CONFIG_PATH = AI_SERVICE_ROOT / "model_provider_configs.local.json"


def load_provider_configs() -> list[dict[str, str]]:
    if not LOCAL_CONFIG_PATH.exists():
        return []

    payload = json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    providers = payload.get("providers")
    return providers if isinstance(providers, list) else []


def save_provider_config(provider: str, base_url: str, api_key: str, protocol: str = "openai_compatible") -> dict[str, str]:
    providers = load_provider_configs()
    normalized_provider = provider.strip()
    next_item = {
        "provider": normalized_provider,
        "protocol": protocol.strip() or "openai_compatible",
        "baseUrl": base_url.strip().rstrip("/"),
        "apiKey": api_key.strip(),
    }
    updated = [item for item in providers if str(item.get("provider", "")).strip().lower() != normalized_provider.lower()]
    updated.append(next_item)
    updated.sort(key=lambda item: str(item.get("provider", "")).lower())
    LOCAL_CONFIG_PATH.write_text(
        json.dumps({"providers": updated}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return next_item


def delete_provider_config(provider: str) -> None:
    normalized_provider = provider.strip().lower()
    providers = load_provider_configs()
    updated = [item for item in providers if str(item.get("provider", "")).strip().lower() != normalized_provider]
    LOCAL_CONFIG_PATH.write_text(
        json.dumps({"providers": updated}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def find_provider_config(provider: str) -> dict[str, str] | None:
    normalized = provider.strip().lower()
    return next(
        (item for item in load_provider_configs() if str(item.get("provider", "")).strip().lower() == normalized),
        None,
    )
