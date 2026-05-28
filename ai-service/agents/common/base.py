from __future__ import annotations

from abc import ABC, abstractmethod

from .types import AgentContext, AgentResult


class BaseAgent(ABC):
    name: str
    skill_path: str

    @abstractmethod
    def run(self, context: AgentContext) -> AgentResult:
        raise NotImplementedError
