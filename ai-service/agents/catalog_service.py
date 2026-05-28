from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class AgentCatalogItem:
    name: str
    display_name: str
    soul: str
    skill: str
    category_hint: str


def _display_name(agent_name: str) -> str:
    mapping = {
        "leader_agent": "总控对话智能体",
        "travel_analytics_agent": "旅游行为数据编排智能体",
        "scenic_structured_agent": "景点结构化数据智能体",
        "guide_script_agent": "口播脚本生成智能体",
    }
    return mapping.get(agent_name, agent_name)


def _category_hint(agent_name: str) -> str:
    mapping = {
        "leader_agent": "chat",
        "travel_analytics_agent": "multimodal",
        "scenic_structured_agent": "chat",
        "guide_script_agent": "chat",
    }
    return mapping.get(agent_name, "chat")


def load_agent_catalog() -> list[AgentCatalogItem]:
    agents_root = Path(__file__).resolve().parent
    items: list[AgentCatalogItem] = []

    for child in sorted(agents_root.iterdir(), key=lambda p: p.name.lower()):
        if not child.is_dir():
            continue
        if child.name.startswith("__") or child.name in {"common"}:
            continue
        if not child.name.endswith("_agent"):
            continue

        skill_file = child / "SKILL.md"
        soul_file = child / "SOUL.md"
        agent_file = child / "agent.py"
        if not (skill_file.exists() and soul_file.exists() and agent_file.exists()):
            continue

        agent_name = child.name
        items.append(
            AgentCatalogItem(
                name=agent_name,
                display_name=_display_name(agent_name),
                soul=str(Path("agents") / agent_name / "SOUL.md"),
                skill=str(Path("agents") / agent_name / "SKILL.md"),
                category_hint=_category_hint(agent_name),
            )
        )
    return items
