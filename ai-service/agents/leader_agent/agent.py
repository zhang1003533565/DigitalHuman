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


DEFAULT_SYSTEM_PROMPT = (
    "你是 DigitalHuman 的 leader_agent，是负责承接用户请求并调配其他智能体的主智能体。"
    "当前阶段暂不调度其他智能体，只负责快速对话。"
    "请使用简体中文回答，语气自然、可靠、简洁。"
    "当用户提出需要专业智能体处理的任务时，可以说明后续会交给对应智能体，但不要假装已经完成调度。"
    "如果问题缺少事实依据或你无法确定，请直接说明并给出通用建议。"
    "请将回复字数控制在200字以内。"
)

logger = logging.getLogger(__name__)
PROVIDER_FAILURES = (ProviderCallError, requests.RequestException, HTTPException)


class LeaderAgent(BaseAgent):
    name = "leader_agent"
    skill_path = "agents/leader_agent/SKILL.md"

    def run(self, context: AgentContext) -> AgentResult:
        prepared = self._prepare_messages(context)
        if isinstance(prepared, AgentResult):
            return prepared

        messages, provider, model, provider_config, timeout_seconds = prepared
        history_count = len(messages) - 2
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
                    "dispatchEnabled": False,
                },
                provider=provider,
                model=model,
            )
        except PROVIDER_FAILURES as exc:
            logger.warning(
                "leader provider call degraded provider=%s model=%s error_type=%s",
                provider,
                model,
                type(exc).__name__,
            )
            output = normalize_agent_result(
                {
                    "answer": FALLBACK_ANSWER,
                    "usedProvider": provider,
                    "usedModel": model,
                    "historyCount": history_count,
                    "dispatchEnabled": False,
                },
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
        prepared = self._prepare_messages(context)
        if isinstance(prepared, AgentResult):
            return prepared

        messages, provider, model, provider_config, timeout_seconds = prepared

        def _safe_stream() -> Generator[str, None, None]:
            try:
                client = get_provider_client(provider, provider_config)
                stream_fn = getattr(client, "generate_answer_stream", None)
                if callable(stream_fn):
                    yield from stream_fn(
                        model, messages, temperature=0.6, timeout_seconds=timeout_seconds
                    )
                    return
                answer = client.generate_answer(
                    model, messages, temperature=0.6, timeout_seconds=timeout_seconds
                )
                if answer:
                    yield answer
            except PROVIDER_FAILURES as exc:
                logger.warning(
                    "leader provider stream degraded provider=%s model=%s error_type=%s",
                    provider,
                    model,
                    type(exc).__name__,
                )
                yield FALLBACK_ANSWER

        return _safe_stream()

    def chat(self, message: str) -> dict[str, object]:
        message = (message or "").strip()
        return {
            "success": True,
            "agent": self.name,
            "warnings": [],
            "output": {
                "answer": "你好，我是主智能体。当前我先支持快速对话，后续会负责调配其他专业智能体。" if not message else (
                    f"已收到：{message}。当前我先作为主智能体处理快速对话，专业智能体调度稍后接入。"
                ),
                "dispatchEnabled": False,
            },
        }

    def _prepare_messages(
        self, context: AgentContext
    ) -> tuple[list[dict[str, object]], str, str, dict[str, str], float] | AgentResult:
        message = normalize_text(context.metadata.get("message"))
        if not message:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["message 不能为空"])

        provider = normalize_text(context.metadata.get("provider"))
        model = normalize_text(context.metadata.get("model"))
        base_url = normalize_text(context.metadata.get("baseUrl"))
        api_key = normalize_text(context.metadata.get("apiKey"))
        if not all([provider, model, base_url, api_key]):
            return AgentResult(
                agent=self.name,
                success=False,
                output={},
                warnings=["模型配置不完整，请在后台管理中完成 CHAT 模型与 Provider 配置"],
            )

        provider_config = {"provider": provider, "baseUrl": base_url, "apiKey": api_key}
        timeout_seconds = normalize_timeout_seconds(context.metadata.get("timeoutSeconds"))
        history = _normalize_history(context.metadata.get("history"))
        system_prompt = normalize_text(context.metadata.get("systemPrompt")) or DEFAULT_SYSTEM_PROMPT
        messages: list[dict[str, object]] = [{"role": "system", "content": system_prompt}, *history]
        messages.append({"role": "user", "content": message})
        return messages, provider, model, provider_config, timeout_seconds
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
