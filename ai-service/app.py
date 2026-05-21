#!/usr/bin/env python3
"""
RAG FastAPI service for ingesting the local knowledge base and serving retrieval.
"""

from fastapi import FastAPI, File, UploadFile

from rag.schemas import IngestRequest, IngestResponse, KnowledgeDocumentInfo, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse, UploadKnowledgeResponse
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
