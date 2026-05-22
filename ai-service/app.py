#!/usr/bin/env python3
"""
RAG FastAPI service for ingesting the local knowledge base and serving retrieval.
"""

from fastapi import FastAPI, File, UploadFile

from admin_config import load_provider_configs, save_provider_config
from providers import sync_provider_models as sync_official_provider_models
from rag.schemas import IngestRequest, IngestResponse, KnowledgeDocumentInfo, ProviderConfigRequest, ProviderConfigResponse, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse, SyncProviderModelsRequest, SyncProviderModelsResponse, UploadKnowledgeResponse
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


@app.get("/admin/providers", response_model=list[ProviderConfigResponse])
def list_provider_configs() -> list[ProviderConfigResponse]:
    return [ProviderConfigResponse.model_validate(item) for item in load_provider_configs()]


@app.put("/admin/providers", response_model=ProviderConfigResponse)
def update_provider_config(request: ProviderConfigRequest) -> ProviderConfigResponse:
    saved = save_provider_config(request.provider, request.base_url, request.api_key)
    return ProviderConfigResponse.model_validate(saved)


@app.post("/admin/providers/sync-models", response_model=SyncProviderModelsResponse)
def sync_provider_models(request: SyncProviderModelsRequest) -> SyncProviderModelsResponse:
    provider = request.provider.strip()
    config = save_provider_config(provider, request.base_url, request.api_key)
    model_ids = sync_official_provider_models(provider, config["baseUrl"], config["apiKey"])
    return SyncProviderModelsResponse.model_validate({
        "provider": provider,
        "category": request.category,
        "baseUrl": config["baseUrl"],
        "syncedCount": len(model_ids),
        "modelIds": model_ids,
    })
