from __future__ import annotations

import time
import unittest
from unittest.mock import patch

from agents.common.types import AgentContext, normalize_agent_result
from agents.leader_agent.agent import LeaderAgent


class AgentContractTests(unittest.TestCase):
    def test_leader_result_is_structured(self) -> None:
        result = normalize_agent_result({"answer": "欢迎来到灵山"})

        self.assertEqual(result["answer"], "欢迎来到灵山")
        self.assertEqual(result["spots"], [])
        self.assertEqual(result["routes"], [])
        self.assertEqual(result["suggestions"], [])
        self.assertEqual(result["sources"], [])
        self.assertFalse(result["degraded"])
        self.assertEqual(result["provider"], "")
        self.assertEqual(result["model"], "")

    def test_provider_timeout_returns_safe_degraded_result(self) -> None:
        class SlowClient:
            def generate_answer(self, *args: object, **kwargs: object) -> str:
                time.sleep(0.2)
                return "不应返回"

        context = AgentContext(
            file_name="",
            file_path="",
            metadata={
                "message": "介绍一下灵山",
                "provider": "deepseek",
                "model": "chat-model",
                "baseUrl": "https://example.invalid",
                "apiKey": "secret",
                "timeoutSeconds": 0.01,
            },
        )

        with patch("agents.leader_agent.agent.get_provider_client", return_value=SlowClient()):
            result = LeaderAgent().run(context)

        self.assertTrue(result.success)
        self.assertTrue(result.output["degraded"])
        self.assertTrue(result.output["answer"])
        self.assertEqual(result.output["spots"], [])
        self.assertEqual(result.output["routes"], [])
        self.assertEqual(result.output["suggestions"], [])
        self.assertEqual(result.output["sources"], [])
        self.assertNotIn("Timeout", result.output["answer"])
        self.assertNotIn("Traceback", result.output["answer"])
        self.assertEqual(result.output["provider"], "deepseek")
        self.assertEqual(result.output["model"], "chat-model")

    def test_provider_exception_is_not_exposed_in_answer(self) -> None:
        class FailingClient:
            def generate_answer(self, *args: object, **kwargs: object) -> str:
                raise RuntimeError("api-key-secret stack detail")

        context = AgentContext(
            file_name="",
            file_path="",
            metadata={
                "message": "推荐游览路线",
                "provider": "deepseek",
                "model": "chat-model",
                "baseUrl": "https://example.invalid",
                "apiKey": "secret",
                "timeoutSeconds": 1,
            },
        )

        with patch("agents.leader_agent.agent.get_provider_client", return_value=FailingClient()):
            result = LeaderAgent().run(context)

        self.assertTrue(result.output["degraded"])
        self.assertNotIn("api-key-secret", result.output["answer"])
        self.assertNotIn("RuntimeError", result.output["answer"])


if __name__ == "__main__":
    unittest.main()
