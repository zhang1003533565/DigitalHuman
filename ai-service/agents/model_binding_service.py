from __future__ import annotations

from pydantic import BaseModel, Field

from agents.catalog_service import load_agent_catalog
from model_providers.config_store import (
    AgentModelBinding,
    ensure_agent_model_defaults,
    find_provider_config,
    list_agent_model_bindings,
    save_agent_model_bindings,
)

ALLOWED_CATEGORIES = {"chat", "multimodal", "vision", "embedding", "speech"}


class AgentModelBindingItem(BaseModel):
    agent: str
    category: str
    provider: str
    model: str
    timeout_seconds: int = Field(alias="timeoutSeconds", ge=1, le=600)
    enabled: bool = True


class AgentModelBindingPayload(BaseModel):
    items: list[AgentModelBindingItem]


def get_agent_bindings() -> AgentModelBindingPayload:
    catalog = load_agent_catalog()
    ensure_agent_model_defaults([item.name for item in catalog])
    allowed_agents = {item.name for item in catalog}
    bindings = list_agent_model_bindings()
    return AgentModelBindingPayload(
        items=[
            AgentModelBindingItem(
                agent=item.agent,
                category=item.category,
                provider=item.provider,
                model=item.model,
                timeoutSeconds=item.timeout_seconds,
                enabled=item.enabled,
            )
            for item in bindings
            if item.agent in allowed_agents
        ]
    )


def update_agent_bindings(payload: AgentModelBindingPayload) -> AgentModelBindingPayload:
    catalog = load_agent_catalog()
    allowed_agents = {item.name for item in catalog}
    normalized_items: list[AgentModelBinding] = []
    seen_agents: set[str] = set()

    for raw in payload.items:
        agent = raw.agent.strip()
        category = raw.category.strip().lower()
        provider = raw.provider.strip()
        model = raw.model.strip()

        if agent not in allowed_agents:
            raise ValueError(f"unknown agent: {agent}")
        if category not in ALLOWED_CATEGORIES:
            raise ValueError(f"unknown category: {category}")
        if not provider or not model:
            raise ValueError(f"agent {agent}: provider/model 不能为空")
        if agent in seen_agents:
            raise ValueError(f"agent {agent}: 重复配置")
        if not find_provider_config(provider):
            raise ValueError(f"agent {agent}: provider 未配置：{provider}")

        seen_agents.add(agent)
        normalized_items.append(
            AgentModelBinding(
                agent=agent,
                category=category,
                provider=provider,
                model=model,
                timeout_seconds=int(raw.timeout_seconds),
                enabled=bool(raw.enabled),
            )
        )

    saved = save_agent_model_bindings(normalized_items)
    return AgentModelBindingPayload(
        items=[
            AgentModelBindingItem(
                agent=item.agent,
                category=item.category,
                provider=item.provider,
                model=item.model,
                timeoutSeconds=item.timeout_seconds,
                enabled=item.enabled,
            )
            for item in saved
        ]
    )
