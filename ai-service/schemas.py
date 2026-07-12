from __future__ import annotations

from pydantic import BaseModel, Field


class AgentOutputResponse(BaseModel):
    answer: str
    spots: list[object] = Field(default_factory=list)
    routes: list[object] = Field(default_factory=list)
    suggestions: list[object] = Field(default_factory=list)
    sources: list[object] = Field(default_factory=list)
    degraded: bool = False
    provider: str = ""
    model: str = ""

    model_config = {"extra": "allow"}


class ModelTestRequest(BaseModel):
    provider: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    model_id: str = Field(..., min_length=1, alias="modelId")
    text: str | None = None
    image_data_url: str | None = Field(default=None, alias="imageDataUrl")
    mode: str | None = None
    base_url: str | None = Field(default=None, alias="baseUrl")
    api_key: str | None = Field(default=None, alias="apiKey")


class ModelTestResponse(BaseModel):
    success: bool
    provider: str
    category: str
    model_id: str = Field(alias="modelId")
    message: str
    detail: str | None = None
    caption: str | None = None
    ocr_text: str | None = Field(default=None, alias="ocrText")
    model_answer: str | None = Field(default=None, alias="modelAnswer")
    scene_summary: str | None = Field(default=None, alias="sceneSummary")


class ProviderConfigRequest(BaseModel):
    provider: str = Field(..., min_length=1)
    base_url: str = Field(..., min_length=1, alias="baseUrl")
    api_key: str = Field(..., min_length=1, alias="apiKey")
    protocol: str = "openai_compatible"


class ProviderConfigResponse(BaseModel):
    provider: str
    base_url: str = Field(alias="baseUrl")
    api_key_masked: str = Field(alias="apiKeyMasked")
    configured: bool
    protocol: str


class ProviderDeleteRequest(BaseModel):
    provider: str = Field(..., min_length=1)
