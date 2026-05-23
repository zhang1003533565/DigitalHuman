#!/usr/bin/env python3
"""
RAG FastAPI service for ingesting the local knowledge base and serving retrieval.
"""

from fastapi import FastAPI, File, HTTPException, UploadFile

from model_provider_config import delete_provider_config, load_provider_configs, save_provider_config
from model_test import test_model
from rag.schemas import IngestRequest, IngestResponse, KnowledgeDocumentInfo, ModelTestRequest, ModelTestResponse, ProviderConfigRequest, ProviderConfigResponse, ProviderDeleteRequest, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse, UploadKnowledgeResponse
from rag.service import RagService
from tts import router as tts_router


app = FastAPI(title="DigitalHuman RAG Service")
rag_service = RagService()
app.include_router(tts_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/kb/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    return rag_service.ingest(request)


@app.get("/kb/documents", response_model=list[KnowledgeDocumentInfo])
def list_documents() -> list[KnowledgeDocumentInfo]:
    return rag_service.list_documents()


@app.post("/kb/documents/upload", response_model=UploadKnowledgeResponse)
async def upload_document(file: UploadFile = File(...)) -> UploadKnowledgeResponse:
    return rag_service.upload_document(file.filename or "uploaded_document.txt", file.file)


@app.post("/rag/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest) -> RetrieveResponse:
    return rag_service.retrieve(request)


@app.post("/rag/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    return rag_service.query(request)


@app.post("/admin/model-test", response_model=ModelTestResponse)
def model_test(request: ModelTestRequest) -> ModelTestResponse:
    try:
        result = test_model(request.provider, request.category, request.model_id)
        return ModelTestResponse.model_validate({
            "success": result.success,
            "provider": request.provider,
            "category": request.category,
            "modelId": request.model_id,
            "message": result.message,
            "detail": result.detail,
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
