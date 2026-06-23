from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path


CALL_LIMIT_PER_MINUTE = 60
_CALL_TIMES: dict[str, list[float]] = {}


def runtime_dir() -> Path:
    path = Path(__file__).resolve().parent / ".runtime"
    path.mkdir(parents=True, exist_ok=True)
    return path


def check_provider_quota(provider: str) -> None:
    now = time.time()
    window = now - 60
    times = [item for item in _CALL_TIMES.get(provider, []) if item >= window]
    if len(times) >= CALL_LIMIT_PER_MINUTE:
        raise RuntimeError(f"provider_rate_limited:{provider}")
    times.append(now)
    _CALL_TIMES[provider] = times


def log_provider_call(provider: str, model: str, ok: bool, detail: str | None = None) -> None:
    item = {
        "time": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "provider": provider,
        "model": model,
        "ok": ok,
        "detail": sanitize_detail(detail),
    }
    path = runtime_dir() / "provider_calls.jsonl"
    with path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(item, ensure_ascii=False) + "\n")


def provider_health_summary() -> list[dict[str, object]]:
    path = runtime_dir() / "provider_calls.jsonl"
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines()[-500:]:
        try:
            rows.append(json.loads(line))
        except Exception:
            continue
    providers = sorted({str(item.get("provider", "")) for item in rows if item.get("provider")})
    summary = []
    for provider in providers:
        items = [item for item in rows if item.get("provider") == provider]
        failures = [item for item in items if not item.get("ok")]
        summary.append({
            "provider": provider,
            "calls": len(items),
            "failures": len(failures),
            "failureRate": round(len(failures) * 100 / len(items), 2) if items else 0,
            "lastStatus": "ok" if items and items[-1].get("ok") else "failed",
        })
    return summary


def sanitize_detail(detail: str | None) -> str | None:
    if not detail:
        return None
    compact = detail.replace("\n", " ")[:500]
    if "sk-" in compact or "api" in compact.lower():
        return hashlib.sha256(compact.encode("utf-8")).hexdigest()[:16]
    return compact
