from __future__ import annotations

import logging
from typing import Any, Generator

import requests
from fastapi import HTTPException

from agents.common.base import BaseAgent
from agents.common.types import AgentContext, AgentResult, FALLBACK_ANSWER, normalize_agent_result, normalize_timeout_seconds
from agents.common.utils import normalize_text
from model_providers.registry import get_provider_client
from model_providers.openai_compatible_client import ProviderCallError


logger = logging.getLogger(__name__)
PROVIDER_FAILURES = (ProviderCallError, requests.RequestException, HTTPException)


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
    ) -> tuple[list[dict[str, object]], str, str, dict[str, str], float] | AgentResult:
        """校验前置条件并构建 messages 列表。
        成功返回 (messages, provider, model, provider_config)，失败返回 AgentResult。
        """
        message = normalize_text(context.metadata.get("message"))
        if not message:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["message 不能为空"])

        # --- 从 Java 后台（MySQL）传入的模型配置 ---
        provider = normalize_text(context.metadata.get("provider"))
        model = normalize_text(context.metadata.get("model"))
        base_url = normalize_text(context.metadata.get("baseUrl"))
        api_key = normalize_text(context.metadata.get("apiKey"))

        if not all([provider, model, base_url, api_key]):
            return AgentResult(
                agent=self.name, success=False, output={},
                warnings=["模型配置不完整，请在后台管理中完成 CHAT 模型与 Provider 配置"],
            )

        provider_config = {"provider": provider, "baseUrl": base_url, "apiKey": api_key}
        timeout_seconds = normalize_timeout_seconds(context.metadata.get("timeoutSeconds"))

        history = _normalize_history(context.metadata.get("history"))
        system_prompt = normalize_text(context.metadata.get("systemPrompt")) or DEFAULT_SYSTEM_PROMPT
        messages: list[dict[str, object]] = [{"role": "system", "content": system_prompt}, *history]
        messages.append({"role": "user", "content": message})
        return messages, provider, model, provider_config, timeout_seconds

    def run(self, context: AgentContext) -> AgentResult:
        prepared = self._prepare_messages(context)
        if isinstance(prepared, AgentResult):
            return prepared

        messages, provider, model, provider_config, timeout_seconds = prepared
        history_count = len(messages) - 2  # 减去 system prompt + 当前 user message
        try:
            client = get_provider_client(provider, provider_config)
            answer = client.generate_answer(
                model, messages, temperature=0.6, timeout_seconds=timeout_seconds
            )
            output = normalize_agent_result(
                {
                    "answer": answer,
                    "usedProvider": provider,
                    "usedModel": model,
                    "historyCount": history_count,
                },
                provider=provider,
                model=model,
            )
        except PROVIDER_FAILURES as exc:
            logger.warning(
                "basic chat provider call degraded provider=%s model=%s error_type=%s",
                provider,
                model,
                type(exc).__name__,
            )
            output = normalize_agent_result(
                {"answer": FALLBACK_ANSWER, "usedProvider": provider, "usedModel": model, "historyCount": history_count},
                provider=provider,
                model=model,
                degraded=True,
            )
        return AgentResult(
            agent=self.name,
            success=True,
            output=output,
            warnings=[],
        )

    def run_stream(self, context: AgentContext) -> Generator[str, None, None] | AgentResult:
        """流式输出版本：成功时返回 Generator[str]，失败时返回 AgentResult。"""
        prepared = self._prepare_messages(context)
        if isinstance(prepared, AgentResult):
            return prepared

        messages, provider, model, provider_config, timeout_seconds = prepared

        def _safe_stream() -> Generator[str, None, None]:
            try:
                client = get_provider_client(provider, provider_config)
                yield from client.generate_answer_stream(
                    model, messages, temperature=0.6, timeout_seconds=timeout_seconds
                )
            except PROVIDER_FAILURES as exc:
                logger.warning(
                    "basic chat provider stream degraded provider=%s model=%s error_type=%s",
                    provider,
                    model,
                    type(exc).__name__,
                )
                yield FALLBACK_ANSWER

        return _safe_stream()


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
