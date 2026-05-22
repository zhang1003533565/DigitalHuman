from __future__ import annotations

import json
from pathlib import Path
from threading import Lock


AI_SERVICE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = AI_SERVICE_ROOT.parent
STORAGE_ROOT = PROJECT_ROOT / "storage"
PROVIDER_CONFIG_PATH = STORAGE_ROOT / "ai_provider_configs.json"
_LOCK = Lock()


def load_provider_configs() -> list[dict[str, str]]:
    if not PROVIDER_CONFIG_PATH.exists():
        return []
    with _LOCK:
        return json.loads(PROVIDER_CONFIG_PATH.read_text(encoding="utf-8"))


def save_provider_config(provider: str, base_url: str, api_key: str) -> dict[str, str]:
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    with _LOCK:
        items = load_provider_configs()
        normalized_provider = provider.strip()
        next_items = [item for item in items if item.get("provider", "").lower() != normalized_provider.lower()]
        record = {
            "provider": normalized_provider,
            "baseUrl": base_url.strip().rstrip("/"),
            "apiKey": api_key.strip(),
        }
        next_items.append(record)
        next_items.sort(key=lambda item: item["provider"].lower())
        PROVIDER_CONFIG_PATH.write_text(
            json.dumps(next_items, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return record


def find_provider_config(provider: str) -> dict[str, str] | None:
    normalized_provider = provider.strip().lower()
    return next(
        (item for item in load_provider_configs() if item.get("provider", "").lower() == normalized_provider),
        None,
    )
