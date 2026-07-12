from __future__ import annotations

import math
import unittest
from unittest.mock import Mock, patch

import requests
from fastapi import HTTPException

from agents.basic_chat_agent.agent import BasicChatAgent
from agents.common.types import AgentContext, normalize_agent_result, normalize_timeout_seconds
from agents.leader_agent.agent import LeaderAgent
from model_providers.openai_compatible_client import OpenAICompatibleProviderClient


def chat_context(timeout: object = 1) -> AgentContext:
    return AgentContext(
        file_name="",
        file_path="",
        metadata={
            "message": "介绍一下灵山",
            "provider": "deepseek",
            "model": "chat-model",
            "baseUrl": "https://example.invalid",
            "apiKey": "secret",
            "timeoutSeconds": timeout,
        },
    )


class AgentContractTests(unittest.TestCase):
    def test_leader_result_is_structured(self) -> None:
        result = normalize_agent_result({"answer": "欢迎来到灵山"})
        self.assertEqual(result["answer"], "欢迎来到灵山")
        for field in ("spots", "routes", "suggestions", "sources"):
            self.assertEqual(result[field], [])
        self.assertFalse(result["degraded"])
        self.assertEqual(result["provider"], "")
        self.assertEqual(result["model"], "")

    def test_timeout_normalization_rejects_non_finite_and_non_positive_values(self) -> None:
        for value in (0, -1, math.nan, math.inf, -math.inf, "bad", None):
            with self.subTest(value=value):
                self.assertEqual(normalize_timeout_seconds(value), 90.0)
        self.assertEqual(normalize_timeout_seconds(12.5), 12.5)
        self.assertEqual(normalize_timeout_seconds(601), 90.0)

    def test_openai_compatible_client_passes_timeout_to_http_request(self) -> None:
        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = {"choices": [{"message": {"content": "欢迎"}}]}
        client = OpenAICompatibleProviderClient("DeepSeek", "https://example.invalid", "secret")

        with patch("model_providers.openai_compatible_client.requests.post", return_value=response) as post:
            answer = client.chat_completion(
                model_id="chat-model", messages=[{"role": "user", "content": "hi"}], timeout_seconds=7.5
            )

        self.assertEqual(answer, "欢迎")
        self.assertEqual(post.call_args.kwargs["timeout"], 7.5)

    def test_stream_response_is_closed_when_http_status_check_fails(self) -> None:
        response = Mock()
        response.raise_for_status.side_effect = requests.HTTPError(response=response)
        response.json.return_value = {"error": {"message": "bad request"}}
        client = OpenAICompatibleProviderClient("DeepSeek", "https://example.invalid", "secret")

        with patch("model_providers.openai_compatible_client.requests.post", return_value=response):
            with self.assertRaises(HTTPException):
                list(client.chat_completion_stream(model_id="chat-model", messages=[]))

        response.close.assert_called_once_with()

    def test_leader_timeout_returns_safe_degraded_result(self) -> None:
        client = Mock()
        client.generate_answer.side_effect = requests.Timeout("api-key-secret timeout")
        with patch("agents.leader_agent.agent.get_provider_client", return_value=client):
            result = LeaderAgent().run(chat_context(3))

        client.generate_answer.assert_called_once_with(
            "chat-model", unittest.mock.ANY, temperature=0.6, timeout_seconds=3.0
        )
        self.assertTrue(result.output["degraded"])
        self.assertNotIn("api-key-secret", result.output["answer"])

    def test_leader_stream_timeout_yields_only_safe_fallback(self) -> None:
        client = Mock()

        def broken_stream(*args: object, **kwargs: object):
            yield "开始"
            raise requests.Timeout("stream-secret")

        client.generate_answer_stream.side_effect = broken_stream
        with patch("agents.leader_agent.agent.get_provider_client", return_value=client):
            chunks = list(LeaderAgent().run_stream(chat_context(4)))

        self.assertEqual(chunks[0], "开始")
        self.assertTrue(chunks[-1])
        self.assertNotIn("stream-secret", "".join(chunks))
        client.generate_answer_stream.assert_called_once_with(
            "chat-model", unittest.mock.ANY, temperature=0.6, timeout_seconds=4.0
        )

    def test_basic_chat_sync_and_stream_use_timeout_and_degrade_safely(self) -> None:
        client = Mock()
        client.generate_answer.side_effect = requests.ConnectionError("sync-secret")

        def broken_stream(*args: object, **kwargs: object):
            raise requests.Timeout("stream-secret")
            yield "unreachable"

        client.generate_answer_stream.side_effect = broken_stream
        with patch("agents.basic_chat_agent.agent.get_provider_client", return_value=client):
            sync_result = BasicChatAgent().run(chat_context(5))
            stream_chunks = list(BasicChatAgent().run_stream(chat_context(6)))

        self.assertTrue(sync_result.output["degraded"])
        self.assertNotIn("sync-secret", sync_result.output["answer"])
        self.assertNotIn("stream-secret", "".join(stream_chunks))
        client.generate_answer.assert_called_once_with(
            "chat-model", unittest.mock.ANY, temperature=0.6, timeout_seconds=5.0
        )
        client.generate_answer_stream.assert_called_once_with(
            "chat-model", unittest.mock.ANY, temperature=0.6, timeout_seconds=6.0
        )

    def test_programming_errors_are_not_swallowed_by_agents(self) -> None:
        client = Mock()
        client.generate_answer.side_effect = TypeError("bug")
        with patch("agents.leader_agent.agent.get_provider_client", return_value=client):
            with self.assertRaises(TypeError):
                LeaderAgent().run(chat_context())


if __name__ == "__main__":
    unittest.main()
