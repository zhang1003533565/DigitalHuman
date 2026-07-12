#!/usr/bin/env python3
"""
FastAPI service for DigitalHuman AI capabilities.
"""

from fastapi import FastAPI, HTTPException
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


@app.get("/admin/providers", response_model=list[ProviderConfigResponse])
def list_provider_configs() -> list[ProviderConfigResponse]:
    return [ProviderConfigResponse.model_validate(item) for item in load_provider_configs()]


@app.put("/admin/providers", response_model=ProviderConfigResponse)
def update_provider_config(request: ProviderConfigRequest) -> ProviderConfigResponse:
    saved = save_provider_config(request.provider, request.base_url, request.api_key, request.protocol)
    return ProviderConfigResponse.model_validate(saved)


@app.post("/admin/providers/delete")
def remove_provider_config(request: ProviderDeleteRequest) -> dict[str, bool]:
    delete_provider_config(request.provider)
    return {"success": True}
