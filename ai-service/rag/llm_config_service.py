from __future__ import annotations

from pydantic import BaseModel, Field

from model_providers.config_store import find_provider_config, load_llm_runtime_config, save_llm_runtime_config


class LlmRuntimeConfigResponse(BaseModel):
    provider: str
    model: str
    timeout_seconds: int = Field(alias="timeoutSeconds")


class LlmRuntimeConfigRequest(BaseModel):
    provider: str
    model: str
    timeout_seconds: int = Field(alias="timeoutSeconds", ge=1, le=600)


def get_llm_runtime_config() -> LlmRuntimeConfigResponse:
    current = load_llm_runtime_config()
    return LlmRuntimeConfigResponse(
        provider=current.provider,
        model=current.model,
        timeoutSeconds=current.timeout_seconds,
    )


def update_llm_runtime_config(request: LlmRuntimeConfigRequest) -> LlmRuntimeConfigResponse:
    provider = request.provider.strip()
    model = request.model.strip()
    if not provider or not model:
        raise ValueError("provider/model 不能为空")

    provider_config = find_provider_config(provider)
    if not provider_config:
        raise ValueError(f"provider 未配置：{provider}")

    saved = save_llm_runtime_config(provider, model, int(request.timeout_seconds))
    return LlmRuntimeConfigResponse(
        provider=saved.provider,
        model=saved.model,
        timeoutSeconds=saved.timeout_seconds,
    )
