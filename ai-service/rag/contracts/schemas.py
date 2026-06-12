from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


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
    disabled: bool = False
    quality_flags: list[str] = Field(default_factory=list)


class ChunkRecord(BaseModel):
    id: str
    text: str
    payload: ChunkPayload
    score: float | None = None


class RetrievalStage(BaseModel):
    name: str
    query: str
    chunks: list[ChunkRecord] = Field(default_factory=list)


class RetrievalAttempt(BaseModel):
    name: str
    query: str
    dense: RetrievalStage
    reranked: RetrievalStage


class IngestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_dir: str | None = Field(default=None, alias="sourceDir")
    glob: str | None = "*"
    recreate_collection: bool = Field(default=False, alias="recreateCollection")
    embedding_provider: str | None = Field(default=None, alias="embeddingProvider")
    embedding_model: str | None = Field(default=None, alias="embeddingModel")


class IngestResponse(BaseModel):
    files_seen: int
    files_indexed: int
    chunks_indexed: int
    collection: str
    embedding_provider: str | None = Field(default=None, alias="embeddingProvider")
    embedding_model: str | None = Field(default=None, alias="embeddingModel")


class KnowledgeDocumentInfo(BaseModel):
    file_name: str
    size_bytes: int
    updated_at: str
    supported: bool
    version: str | None = None
    status: str | None = None


class KnowledgeDocumentPreview(BaseModel):
    file_name: str = Field(alias="fileName")
    text: str
    sections: list[str] = Field(default_factory=list)


class KnowledgeDocumentDiff(BaseModel):
    file_name: str = Field(alias="fileName")
    current_version: str | None = Field(default=None, alias="currentVersion")
    previous_version: str | None = Field(default=None, alias="previousVersion")
    added_lines: int = Field(default=0, alias="addedLines")
    removed_lines: int = Field(default=0, alias="removedLines")
    preview: list[str] = Field(default_factory=list)


class KnowledgeChunkListResponse(BaseModel):
    file_name: str = Field(alias="fileName")
    chunks: list[ChunkRecord]


class DeleteKnowledgeResponse(BaseModel):
    file_name: str = Field(alias="fileName")
    file_deleted: bool = Field(alias="fileDeleted")
    vectors_deleted: int | None = Field(default=None, alias="vectorsDeleted")


class UploadKnowledgeResponse(BaseModel):
    file_name: str
    size_bytes: int
    updated_at: str
    supported: bool
    version: str | None = None


class RetrieveRequest(BaseModel):
    question: str = Field(..., min_length=1)
    interest: str | None = None
    top_k: int | None = None
    metadata_filter: dict[str, object] | None = Field(default=None, alias="metadataFilter")


class RetrieveResponse(BaseModel):
    chunks: list[ChunkRecord]
    related_spots: list[str]


class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1)
    interest: str | None = None
    top_k: int | None = None
    metadata_filter: dict[str, object] | None = Field(default=None, alias="metadataFilter")
    session_id: str | None = Field(default=None, alias="sessionId")
    trace_id: str | None = Field(default=None, alias="traceId")
    enable_human_review: bool = Field(default=False, alias="enableHumanReview")


class ChunkToggleRequest(BaseModel):
    disabled: bool


class QueryResponse(BaseModel):
    trace_id: str | None = Field(default=None, alias="traceId")
    answer: str
    related_spots: list[str]
    sources: list[ChunkPayload]
    chunks: list[ChunkRecord]
    rewritten_question: str | None = Field(default=None, alias="rewrittenQuestion")
    context_sufficient: bool = Field(default=True, alias="contextSufficient")
    context_reason: str | None = Field(default=None, alias="contextReason")
    quality_passed: bool = Field(default=True, alias="qualityPassed")
    quality_issues: list[str] = Field(default_factory=list, alias="qualityIssues")
    citations_valid: bool = Field(default=True, alias="citationsValid")
    citation_issues: list[str] = Field(default_factory=list, alias="citationIssues")
    review_required: bool = Field(default=False, alias="reviewRequired")
    review_reason: str | None = Field(default=None, alias="reviewReason")
    graph_steps: list[str] = Field(default_factory=list, alias="graphSteps")
    retrieval_attempts: int = Field(default=1, alias="retrievalAttempts")
    retrieval_trace: list[RetrievalAttempt] = Field(default_factory=list, alias="retrievalTrace")
    node_timings_ms: dict[str, float] = Field(default_factory=dict, alias="nodeTimingsMs")
    total_duration_ms: float | None = Field(default=None, alias="totalDurationMs")
    low_confidence: bool = Field(default=False, alias="lowConfidence")
    low_confidence_reason: str | None = Field(default=None, alias="lowConfidenceReason")
    prompt_version: str = Field(default="rag-grounded-v1", alias="promptVersion")
    provider_status: str | None = Field(default=None, alias="providerStatus")
    provider_error: str | None = Field(default=None, alias="providerError")


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
    api_key: str = Field(alias="apiKey")
    protocol: str


class ProviderDeleteRequest(BaseModel):
    provider: str = Field(..., min_length=1)
