#!/usr/bin/env python3
"""
RAG FastAPI service for ingesting the local knowledge base and serving retrieval.
"""

from fastapi import Body, FastAPI, File, HTTPException, UploadFile
from agents.router import router as agents_router

from model_capabilities.testing.model_test_service import test_model
from model_capabilities.tts.router import router as tts_router
from model_providers.config_store import delete_provider_config, load_provider_configs, save_provider_config
from rag.generation.prompt_store import PromptConfig, PromptConfigRequest, load_prompt_config, load_prompt_versions, publish_prompt_version, save_prompt_config
from rag.retrieval.config_store import RetrievalConfig, load_retrieval_config, save_retrieval_config
from rag.llm_config_service import (
    LlmRuntimeConfigRequest,
    LlmRuntimeConfigResponse,
    get_llm_runtime_config,
    update_llm_runtime_config,
)
from rag.application.rag_service import RagService
from rag.contracts.schemas import ChunkToggleRequest, DeleteKnowledgeResponse, IngestRequest, IngestResponse, KnowledgeChunkListResponse, KnowledgeDocumentDiff, KnowledgeDocumentInfo, KnowledgeDocumentPreview, ModelTestRequest, ModelTestResponse, ProviderConfigRequest, ProviderConfigResponse, ProviderDeleteRequest, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse, UploadKnowledgeResponse
from rag.config.settings import validate_settings
from rag.provider_runtime import provider_health_summary


app = FastAPI(title="DigitalHuman RAG Service")
rag_service = RagService()
app.include_router(tts_router)
app.include_router(agents_router)


@app.get("/health")
def health() -> dict[str, object]:
    checks: dict[str, object] = {"service": "ok"}
    try:
        checks["qdrantCollection"] = rag_service.vector_store.collection_status()
        checks["qdrant"] = "ok"
    except Exception as exc:
        checks["qdrant"] = f"error: {exc}"
    checks["llm"] = "configured" if rag_service.llm.is_enabled() else "not_configured"
    checks["llmProvider"] = rag_service.llm.config.provider or "not_set"
    checks["llmModel"] = rag_service.llm.config.model or "not_set"
    checks["embedding"] = rag_service.embedder.status()
    checks["reranker"] = rag_service.settings.reranker_model_name or "disabled"
    checks["knowledgeBaseDir"] = str(rag_service.settings.knowledge_base_dir)
    checks["knowledgeBaseExists"] = rag_service.settings.knowledge_base_dir.exists()
    checks["startupWarnings"] = validate_settings(rag_service.settings)
    checks["providers"] = provider_health_summary()
    status = "ok" if checks.get("qdrant") == "ok" else "degraded"
    return {"status": status, "checks": checks}


@app.post("/kb/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    try:
        return rag_service.ingest(request)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"知识库构建失败：{type(exc).__name__}: {exc}") from exc


@app.get("/kb/documents", response_model=list[KnowledgeDocumentInfo])
def list_documents() -> list[KnowledgeDocumentInfo]:
    return rag_service.list_documents()


@app.post("/kb/documents/upload", response_model=UploadKnowledgeResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadKnowledgeResponse:
    return rag_service.upload_document(file.filename or "uploaded_document.txt", file.file)


@app.delete("/kb/documents/{file_name}", response_model=DeleteKnowledgeResponse)
def delete_document(file_name: str) -> DeleteKnowledgeResponse:
    return rag_service.delete_document(file_name)


@app.post("/kb/documents/{file_name}/rebuild", response_model=IngestResponse)
def rebuild_document(file_name: str, request: IngestRequest | None = Body(default=None)) -> IngestResponse:
    try:
        return rag_service.rebuild_document(
            file_name,
            embedding_model=request.embedding_model if request else None,
            embedding_provider=request.embedding_provider if request else None,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"单文件重建失败：{type(exc).__name__}: {exc}") from exc


@app.get("/kb/documents/{file_name}/chunks", response_model=KnowledgeChunkListResponse)
def list_document_chunks(file_name: str) -> KnowledgeChunkListResponse:
    return rag_service.list_document_chunks(file_name)


@app.get("/kb/documents/{file_name}/preview", response_model=KnowledgeDocumentPreview)
def preview_document(file_name: str) -> KnowledgeDocumentPreview:
    return rag_service.preview_document(file_name)


@app.get("/kb/documents/{file_name}/diff", response_model=KnowledgeDocumentDiff)
def diff_document(file_name: str) -> KnowledgeDocumentDiff:
    return rag_service.diff_document(file_name)


@app.get("/kb/documents/{file_name}/versions")
def list_document_versions(file_name: str) -> list[dict[str, object]]:
    return rag_service.list_document_versions(file_name)


@app.post("/kb/documents/{file_name}/versions/{version}/restore")
def restore_document_version(file_name: str, version: str) -> dict[str, object]:
    return rag_service.restore_document_version(file_name, version)


@app.put("/kb/chunks/{chunk_id}/disabled")
def set_chunk_disabled(chunk_id: str, request: ChunkToggleRequest) -> dict[str, object]:
    return rag_service.set_chunk_disabled(chunk_id, request.disabled)


@app.post("/rag/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest) -> RetrieveResponse:
    return rag_service.retrieve(request)


@app.post("/rag/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    return rag_service.query(request)


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


@app.get("/admin/rag/prompt", response_model=PromptConfig)
def get_rag_prompt() -> PromptConfig:
    return load_prompt_config()


@app.put("/admin/rag/prompt", response_model=PromptConfig)
def update_rag_prompt(request: PromptConfigRequest) -> PromptConfig:
    return save_prompt_config(request)


@app.get("/admin/rag/prompts", response_model=list[PromptConfig])
def list_rag_prompt_versions() -> list[PromptConfig]:
    return load_prompt_versions()


@app.post("/admin/rag/prompts/{version}/publish", response_model=PromptConfig)
def publish_rag_prompt(version: str) -> PromptConfig:
    try:
        return publish_prompt_version(version)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/admin/rag/retrieval-config", response_model=RetrievalConfig)
def get_retrieval_config() -> RetrievalConfig:
    return load_retrieval_config()


@app.put("/admin/rag/retrieval-config", response_model=RetrievalConfig)
def update_retrieval_config(request: RetrievalConfig) -> RetrievalConfig:
    return save_retrieval_config(request)


@app.get("/admin/rag/llm-config", response_model=LlmRuntimeConfigResponse)
def get_llm_config() -> LlmRuntimeConfigResponse:
    return get_llm_runtime_config()


@app.put("/admin/rag/llm-config", response_model=LlmRuntimeConfigResponse)
def set_llm_config(request: LlmRuntimeConfigRequest) -> LlmRuntimeConfigResponse:
    try:
        return update_llm_runtime_config(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
