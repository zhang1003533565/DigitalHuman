#!/usr/bin/env python3
"""
RAG FastAPI service for ingesting the local knowledge base and serving retrieval.
"""

from fastapi import FastAPI

from rag.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse
from rag.service import RagService


app = FastAPI(title="DigitalHuman RAG Service")
rag_service = RagService()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/kb/ingest", response_model=IngestResponse)
def ingest(request: IngestRequest) -> IngestResponse:
    return rag_service.ingest(request)


@app.post("/rag/retrieve", response_model=RetrieveResponse)
def retrieve(request: RetrieveRequest) -> RetrieveResponse:
    return rag_service.retrieve(request)


@app.post("/rag/query", response_model=QueryResponse)
def query(request: QueryRequest) -> QueryResponse:
    return rag_service.query(request)
