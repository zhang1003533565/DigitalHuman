from __future__ import annotations

import json
from pathlib import Path


PROVIDERS_ROOT = Path(__file__).resolve().parent
IGNORED_PROVIDER_DIRS = {"config", "docs", "__pycache__"}


def provider_key(provider: str) -> str:
    return provider.strip().lower().replace(" ", "_").replace("-", "_")


def provider_dir(provider: str) -> Path:
    return PROVIDERS_ROOT / provider_key(provider)


def provider_config_path(provider: str) -> Path:
    return provider_dir(provider) / "config.local.json"


def load_provider_configs() -> list[dict[str, str]]:
    configs: list[dict[str, str]] = []
    for path in PROVIDERS_ROOT.iterdir():
        if not path.is_dir() or path.name in IGNORED_PROVIDER_DIRS:
            continue
        config_path = path / "config.local.json"
        if not config_path.exists():
            continue
        payload = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            configs.append(payload)
    configs.sort(key=lambda item: str(item.get("provider", "")).lower())
    return configs


def save_provider_config(provider: str, base_url: str, api_key: str, protocol: str = "openai_compatible") -> dict[str, str]:
    normalized_provider = provider.strip()
    next_item = {
        "provider": normalized_provider,
        "protocol": protocol.strip() or "openai_compatible",
        "baseUrl": base_url.strip().rstrip("/"),
        "apiKey": api_key.strip(),
    }
    config_path = provider_config_path(normalized_provider)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(
        json.dumps(next_item, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return next_item


def delete_provider_config(provider: str) -> None:
    config_path = provider_config_path(provider)
    if config_path.exists():
        config_path.unlink()


def find_provider_config(provider: str) -> dict[str, str] | None:
    normalized = provider.strip().lower()
    return next(
        (item for item in load_provider_configs() if str(item.get("provider", "")).strip().lower() == normalized),
        None,
    )
