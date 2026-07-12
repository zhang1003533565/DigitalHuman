from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import app


class AdminProviderSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.token = "service-token-for-tests"
        self.env = patch.dict(os.environ, {"AI_SERVICE_ADMIN_TOKEN": self.token})
        self.env.start()

    def tearDown(self) -> None:
        self.env.stop()

    def test_get_requires_service_token(self) -> None:
        self.assertEqual(self.client.get("/admin/providers").status_code, 401)
        self.assertEqual(self.client.get("/admin/providers", headers={"X-Service-Token": "wrong"}).status_code, 403)

    @patch("app.load_provider_configs", return_value=[{
        "provider": "DeepSeek", "baseUrl": "https://example.invalid", "apiKey": "top-secret-key", "protocol": "openai_compatible"
    }])
    def test_get_masks_api_key(self, _load) -> None:
        response = self.client.get("/admin/providers", headers={"X-Service-Token": self.token})
        self.assertEqual(response.status_code, 200)
        body = response.json()[0]
        self.assertTrue(body["configured"])
        self.assertNotIn("apiKey", body)
        self.assertNotIn("top-secret-key", response.text)
        self.assertTrue(body["apiKeyMasked"].endswith("-key"))

    @patch("app.save_provider_config", return_value={
        "provider": "DeepSeek", "baseUrl": "https://example.invalid", "apiKey": "new-secret", "protocol": "openai_compatible"
    })
    def test_put_requires_token_and_returns_masked_response(self, save) -> None:
        payload = {"provider": "DeepSeek", "baseUrl": "https://example.invalid", "apiKey": "new-secret"}
        self.assertEqual(self.client.put("/admin/providers", json=payload).status_code, 401)
        response = self.client.put("/admin/providers", json=payload, headers={"X-Service-Token": self.token})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("new-secret", response.text)
        save.assert_called_once()

    def test_trace_id_is_echoed_or_generated(self) -> None:
        supplied = "visitor-trace-1234"
        self.assertEqual(self.client.get("/health", headers={"X-Trace-Id": supplied}).headers["X-Trace-Id"], supplied)
        self.assertTrue(self.client.get("/health").headers["X-Trace-Id"])

    @patch("app.test_model")
    def test_model_test_requires_service_token(self, test_model) -> None:
        payload = {"provider": "DeepSeek", "category": "chat", "modelId": "deepseek-chat"}
        self.assertEqual(self.client.post("/admin/model-test", json=payload).status_code, 401)
        self.assertEqual(self.client.post("/admin/model-test", json=payload, headers={"X-Service-Token": "wrong"}).status_code, 403)
        test_model.return_value = type("Result", (), {
            "success": True, "message": "ok", "detail": None, "caption": None,
            "ocr_text": None, "model_answer": None, "scene_summary": None,
        })()
        response = self.client.post("/admin/model-test", json=payload, headers={"X-Service-Token": self.token})
        self.assertEqual(response.status_code, 200)

    def test_agent_management_routes_require_service_token(self) -> None:
        bindings = {"items": []}
        for method, path, kwargs in (
            (self.client.get, "/agents/model-bindings", {}),
            (self.client.put, "/agents/model-bindings", {"json": bindings}),
            (self.client.post, "/agents/runtime-test", {"data": {"agent": "basic_chat", "task": "hello"}}),
        ):
            self.assertEqual(method(path, **kwargs).status_code, 401)
            self.assertEqual(method(path, headers={"X-Service-Token": "wrong"}, **kwargs).status_code, 403)

    @patch("agents.router.update_agent_bindings", return_value={"items": []})
    @patch("agents.router.test_agent_runtime", return_value={"success": True})
    def test_agent_management_routes_accept_service_token(self, _runtime, _update) -> None:
        headers = {"X-Service-Token": self.token}
        self.assertEqual(self.client.get("/agents/model-bindings", headers=headers).status_code, 200)
        self.assertEqual(self.client.put("/agents/model-bindings", json={"items": []}, headers=headers).status_code, 200)
        self.assertEqual(self.client.post("/agents/runtime-test", data={"agent": "basic_chat", "task": "hello"}, headers=headers).status_code, 200)


if __name__ == "__main__":
    unittest.main()
