#!/usr/bin/env python3
"""
FastAPI service for DigitalHuman AI capabilities.
"""

import contextvars
import hmac
import logging
import os
import re
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from agents.router import router as agents_router

from model_capabilities.testing.model_test_service import test_model
from model_capabilities.tts.router import router as tts_router
from model_providers.config_store import delete_provider_config, load_provider_configs, save_provider_config
from runtime.provider_runtime import provider_health_summary
from schemas import ModelTestRequest, ModelTestResponse, ProviderConfigRequest, ProviderConfigResponse, ProviderDeleteRequest


app = FastAPI(
    title="DigitalHuman AI Service",
    description="AI agent responses use a stable structured output contract with safe degradation.",
)
app.include_router(tts_router)
app.include_router(agents_router)

TRACE_ID_HEADER = "X-Trace-Id"
SERVICE_TOKEN_HEADER = "X-Service-Token"
TRACE_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
request_trace_id = contextvars.ContextVar("request_trace_id", default="")
logger = logging.getLogger(__name__)


@app.middleware("http")
async def trace_requests(request: Request, call_next):
    supplied = request.headers.get(TRACE_ID_HEADER, "")
    trace_id = supplied if TRACE_ID_PATTERN.fullmatch(supplied) else str(uuid.uuid4())
    token = request_trace_id.set(trace_id)
    request.state.trace_id = trace_id
    try:
        logger.info("request started method=%s path=%s trace_id=%s", request.method, request.url.path, trace_id)
        response: Response = await call_next(request)
        response.headers[TRACE_ID_HEADER] = trace_id
        return response
    finally:
        request_trace_id.reset(token)


def require_admin_token(x_service_token: str | None = Header(default=None, alias=SERVICE_TOKEN_HEADER)) -> None:
    expected = os.getenv("AI_SERVICE_ADMIN_TOKEN", "")
    if not x_service_token:
        raise HTTPException(status_code=401, detail="service token required")
    if not expected or not hmac.compare_digest(x_service_token.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="invalid service token")


def provider_response(item: dict[str, object]) -> ProviderConfigResponse:
    api_key = str(item.get("apiKey") or item.get("api_key") or "")
    masked = "" if not api_key else ("*" * max(4, min(12, len(api_key) - 4)) + api_key[-4:])
    return ProviderConfigResponse.model_validate({
        "provider": item.get("provider"), "baseUrl": item.get("baseUrl") or item.get("base_url"),
        "apiKeyMasked": masked, "configured": bool(api_key), "protocol": item.get("protocol")
    })


@app.get("/health")
def health() -> dict[str, object]:
    checks: dict[str, object] = {"service": "ok"}
    checks["providers"] = provider_health_summary()
    return {"status": "ok", "checks": checks}


@app.post("/admin/model-test", response_model=ModelTestResponse)
def model_test(request: ModelTestRequest) -> ModelTestResponse:
    try:
        result = test_model(request.provider, request.category, request.model_id, request.text, request.image_data_url, request.mode, request.base_url, request.api_key)
        return ModelTestResponse.model_validate({
            "success": result.success,
            "provider": request.provider,
            "category": request.category,
            "modelId": request.model_id,
            "message": result.message,
            "detail": result.detail,
            "caption": result.caption,
            "ocrText": result.ocr_text,
            "modelAnswer": result.model_answer,
            "sceneSummary": result.scene_summary,
        })
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"模型测试内部异常：{exc}") from exc


@app.get("/admin/providers", response_model=list[ProviderConfigResponse], dependencies=[Depends(require_admin_token)])
def list_provider_configs() -> list[ProviderConfigResponse]:
    return [provider_response(item) for item in load_provider_configs()]


@app.put("/admin/providers", response_model=ProviderConfigResponse, dependencies=[Depends(require_admin_token)])
def update_provider_config(request: ProviderConfigRequest) -> ProviderConfigResponse:
    saved = save_provider_config(request.provider, request.base_url, request.api_key, request.protocol)
    return provider_response(saved)


@app.post("/admin/providers/delete", dependencies=[Depends(require_admin_token)])
def remove_provider_config(request: ProviderDeleteRequest) -> dict[str, bool]:
    delete_provider_config(request.provider)
    return {"success": True}
