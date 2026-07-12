from __future__ import annotations

from dataclasses import dataclass, field
import math
from typing import Any


FALLBACK_ANSWER = "当前智能导览服务暂时繁忙。您可以先游览景区主要景点，并以现场公告和工作人员指引为准。"


def normalize_timeout_seconds(value: object, default: float = 90.0) -> float:
    try:
        timeout = float(value)
    except (TypeError, ValueError):
        return default
    return timeout if math.isfinite(timeout) and 0 < timeout <= 600 else default


def normalize_agent_result(
    value: dict[str, Any] | None,
    *,
    provider: str = "",
    model: str = "",
    degraded: bool | None = None,
) -> dict[str, Any]:
    """Return the stable public output contract while preserving legacy fields."""
    raw = dict(value or {})
    answer = raw.get("answer")
    raw["answer"] = answer.strip() if isinstance(answer, str) and answer.strip() else FALLBACK_ANSWER
    for field_name in ("spots", "routes", "suggestions", "sources"):
        if not isinstance(raw.get(field_name), list):
            raw[field_name] = []
    raw["degraded"] = bool(raw.get("degraded", False) if degraded is None else degraded)
    raw["provider"] = str(raw.get("provider") or provider or raw.get("usedProvider") or "").strip()
    raw["model"] = str(raw.get("model") or model or raw.get("usedModel") or "").strip()
    return raw


@dataclass
class AgentContext:
    file_name: str
    file_path: str
    raw_rows: list[dict[str, Any]] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    agent: str
    success: bool
    output: dict[str, Any]
    warnings: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.output = normalize_agent_result(self.output, degraded=True if not self.success else None)
