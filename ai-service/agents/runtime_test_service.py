from __future__ import annotations

from pathlib import Path

from agents.model_binding_service import get_agent_bindings
from model_providers.config_store import find_provider_config
from model_providers.registry import get_provider_client


def _find_binding(agent: str) -> dict[str, object] | None:
    payload = get_agent_bindings()
    for item in payload.items:
        if item.agent == agent:
            return {
                "agent": item.agent,
                "category": item.category,
                "provider": item.provider,
                "model": item.model,
                "timeoutSeconds": item.timeout_seconds,
                "enabled": item.enabled,
            }
    return None


def test_agent_runtime(agent: str, task: str) -> dict[str, object]:
    normalized_agent = (agent or "").strip()
    prompt = (task or "").strip()
    if not normalized_agent:
        raise ValueError("agent 不能为空")
    if not prompt:
        raise ValueError("task 不能为空")

    binding = _find_binding(normalized_agent)
    if not binding:
        raise ValueError(f"未找到智能体绑定配置：{normalized_agent}")
    if not bool(binding.get("enabled")):
        raise ValueError(f"智能体未启用：{normalized_agent}")

    provider = str(binding.get("provider") or "").strip()
    model = str(binding.get("model") or "").strip()
    if not provider or not model:
        raise ValueError(f"智能体模型配置不完整：{normalized_agent}")

    provider_config = find_provider_config(provider)
    if not provider_config:
        raise ValueError(f"provider 未配置：{provider}")

    client = get_provider_client(provider, provider_config)
    messages = [
        {"role": "system", "content": f"你是 {normalized_agent}，请针对任务输出结构化执行结果。"},
        {"role": "user", "content": prompt},
    ]
    answer = client.generate_answer(model, messages, temperature=0.2)
    return {
        "success": True,
        "agent": normalized_agent,
        "provider": provider,
        "model": model,
        "task": prompt,
        "result": answer,
    }
