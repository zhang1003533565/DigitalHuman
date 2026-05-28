from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


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
