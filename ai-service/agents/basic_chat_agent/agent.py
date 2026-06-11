from __future__ import annotations

from typing import Any, Generator

from agents.common.base import BaseAgent
from agents.common.types import AgentContext, AgentResult
from agents.common.utils import normalize_text
from agents.model_binding_service import get_agent_bindings
from model_providers.config_store import find_provider_config
from model_providers.registry import get_provider_client


DEFAULT_SYSTEM_PROMPT = (
    "你是灵山景区智能导览助手。"
    "请使用简体中文回答，语气自然、友好，适合游客咨询。"
    "当前阶段你不依赖知识库检索，请不要假装引用资料；"
    "如果问题缺少事实依据或你无法确定，请直接说明并给出通用建议。"
    "请将回复字数严格控制在200字以内，言简意赅。"
)


class BasicChatAgent(BaseAgent):
    name = "basic_chat_agent"
    skill_path = "agents/basic_chat_agent/SKILL.md"

    def _prepare_messages(
        self, context: AgentContext
    ) -> tuple[list[dict[str, object]], str, str, dict[str, str]] | AgentResult:
        """校验前置条件并构建 messages 列表。
        成功返回 (messages, provider, model, provider_config)，失败返回 AgentResult。
        """
        message = normalize_text(context.metadata.get("message"))
        if not message:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["message 不能为空"])

        binding = _find_binding(self.name)
        if not binding:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["未找到 basic_chat_agent 的模型绑定配置"])
        if not bool(binding.get("enabled")):
            return AgentResult(agent=self.name, success=False, output={}, warnings=["basic_chat_agent 当前未启用"])

        provider = normalize_text(binding.get("provider"))
        model = normalize_text(binding.get("model"))
        provider_config = find_provider_config(provider)
        if not provider_config:
            return AgentResult(agent=self.name, success=False, output={}, warnings=[f"provider 未配置: {provider}"])

        history = _normalize_history(context.metadata.get("history"))
        system_prompt = normalize_text(context.metadata.get("systemPrompt")) or DEFAULT_SYSTEM_PROMPT
        messages: list[dict[str, object]] = [{"role": "system", "content": system_prompt}, *history]
        messages.append({"role": "user", "content": message})
        return messages, provider, model, provider_config

    def run(self, context: AgentContext) -> AgentResult:
        prepared = self._prepare_messages(context)
        if isinstance(prepared, AgentResult):
            return prepared

        messages, provider, model, provider_config = prepared
        history_count = len(messages) - 2  # 减去 system prompt + 当前 user message
        client = get_provider_client(provider, provider_config)
        answer = client.generate_answer(model, messages, temperature=0.6)
        return AgentResult(
            agent=self.name,
            success=True,
            output={
                "answer": answer,
                "usedProvider": provider,
                "usedModel": model,
                "historyCount": history_count,
            },
            warnings=[],
        )

    def run_stream(self, context: AgentContext) -> Generator[str, None, None] | AgentResult:
        """流式输出版本：成功时返回 Generator[str]，失败时返回 AgentResult。"""
        prepared = self._prepare_messages(context)
        if isinstance(prepared, AgentResult):
            return prepared

        messages, provider, model, provider_config = prepared
        client = get_provider_client(provider, provider_config)
        return client.generate_answer_stream(model, messages, temperature=0.6)


def _find_binding(agent: str) -> dict[str, Any] | None:
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


def _normalize_history(raw_history: Any) -> list[dict[str, str]]:
    if not isinstance(raw_history, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in raw_history[-10:]:
        if not isinstance(item, dict):
            continue
        role = normalize_text(item.get("role")).lower()
        content = normalize_text(item.get("content"))
        if role not in {"user", "assistant"} or not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized
