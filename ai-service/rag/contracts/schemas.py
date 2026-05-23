from __future__ import annotations

from pydantic import BaseModel, Field


class ChunkPayload(BaseModel):
    doc_id: str
    source_file: str
    title: str
    section_path: list[str] = Field(default_factory=list)
    chunk_index: int
    tags: list[str] = Field(default_factory=list)
    spot_name: str | None = None
    content_type: str = "paragraph"
    updated_at: str


class ChunkRecord(BaseModel):
    id: str
    text: str
    payload: ChunkPayload
    score: float | None = None


class IngestRequest(BaseModel):
    source_dir: str | None = None
    glob: str = "*"
    recreate_collection: bool = False


class IngestResponse(BaseModel):
    files_seen: int
    files_indexed: int
    chunks_indexed: int
    collection: str


class KnowledgeDocumentInfo(BaseModel):
    file_name: str
    size_bytes: int
    updated_at: str
    supported: bool


class UploadKnowledgeResponse(BaseModel):
    file_name: str
    size_bytes: int
    updated_at: str
    supported: bool


class RetrieveRequest(BaseModel):
    question: str = Field(..., min_length=1)
    interest: str | None = None
    top_k: int | None = None


class RetrieveResponse(BaseModel):
    chunks: list[ChunkRecord]
    related_spots: list[str]


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    interest: str | None = None
    top_k: int | None = None


class QueryResponse(BaseModel):
    answer: str
    related_spots: list[str]
    sources: list[ChunkPayload]
    chunks: list[ChunkRecord]


class ModelTestRequest(BaseModel):
    provider: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    model_id: str = Field(..., min_length=1, alias="modelId")
    text: str | None = None


class ModelTestResponse(BaseModel):
    success: bool
    provider: str
    category: str
    model_id: str = Field(alias="modelId")
    message: str
    detail: str | None = None


class ProviderConfigRequest(BaseModel):
    provider: str = Field(..., min_length=1)
    base_url: str = Field(..., min_length=1, alias="baseUrl")
    api_key: str = Field(..., min_length=1, alias="apiKey")
    protocol: str = "openai_compatible"


class ProviderConfigResponse(BaseModel):
    provider: str
    base_url: str = Field(alias="baseUrl")
    api_key: str = Field(alias="apiKey")
    protocol: str


class ProviderDeleteRequest(BaseModel):
    provider: str = Field(..., min_length=1)
