from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from rag.chunker import ChunkingConfig, build_chunks
from rag.config import get_settings
from rag.embedder import BgeM3Embedder
from rag.llm import LlmConfig, OpenAICompatibleLlm
from rag.parser import parse_document
from rag.prompts import build_grounded_answer
from rag.reranker import BgeReranker
from rag.retriever import Retriever
from rag.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse
from rag.vectordb import QdrantVectorStore


class RagService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.embedder = BgeM3Embedder(self.settings.embedding_model_name)
        self.reranker = BgeReranker(self.settings.reranker_model_name)
        self.llm = OpenAICompatibleLlm(
            LlmConfig(
                base_url=self.settings.llm_base_url,
                api_key=self.settings.llm_api_key,
                model=self.settings.llm_model,
                timeout_seconds=self.settings.llm_timeout_seconds,
            )
        )
        self.vector_store = QdrantVectorStore(
            url=self.settings.qdrant_url,
            api_key=self.settings.qdrant_api_key,
            collection_name=self.settings.qdrant_collection,
        )
        self.retriever = Retriever(
            vector_store=self.vector_store,
            embedder=self.embedder,
            reranker=self.reranker,
            retrieve_limit=self.settings.retrieve_limit,
            rerank_limit=self.settings.rerank_limit,
        )

    def ingest(self, request: IngestRequest) -> IngestResponse:
        source_dir = Path(request.source_dir) if request.source_dir else self.settings.knowledge_base_dir
        if not source_dir.exists():
            raise HTTPException(status_code=400, detail=f"Knowledge base directory does not exist: {source_dir}")

        files = sorted(
            path
            for path in source_dir.glob(request.glob)
            if path.is_file() and path.suffix.lower() in {".docx", ".pdf", ".txt"}
        )
        all_chunks = []
        chunking = ChunkingConfig(
            chunk_size=self.settings.chunk_size,
            chunk_overlap=self.settings.chunk_overlap,
        )
        indexed_files = 0

        for path in files:
            elements = parse_document(path)
            if not elements:
                continue
            chunks = build_chunks(path, elements, chunking)
            if not chunks:
                continue
            all_chunks.extend(chunks)
            indexed_files += 1

        if not all_chunks:
            return IngestResponse(
                files_seen=len(files),
                files_indexed=0,
                chunks_indexed=0,
                collection=self.settings.qdrant_collection,
            )

        vectors = self.embedder.embed_documents([chunk.text for chunk in all_chunks])
        if request.recreate_collection:
            self.vector_store.recreate_collection(len(vectors[0]))
        else:
            self.vector_store.ensure_collection(len(vectors[0]))
        self.vector_store.upsert(all_chunks, vectors)

        return IngestResponse(
            files_seen=len(files),
            files_indexed=indexed_files,
            chunks_indexed=len(all_chunks),
            collection=self.settings.qdrant_collection,
        )

    def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        chunks = self.retriever.retrieve(request.question, top_k=request.top_k)
        return RetrieveResponse(
            chunks=chunks,
            related_spots=extract_related_spots(chunks),
        )

    def query(self, request: QueryRequest) -> QueryResponse:
        chunks = self.retriever.retrieve(request.question, top_k=request.top_k)
        answer = self.llm.generate_answer(request.question, request.interest, chunks)
        if not answer:
            answer = build_grounded_answer(request.question, chunks)
        return QueryResponse(
            answer=answer,
            related_spots=extract_related_spots(chunks),
            sources=[chunk.payload for chunk in chunks],
            chunks=chunks,
        )


def extract_related_spots(chunks) -> list[str]:
    spots: list[str] = []
    for chunk in chunks:
        if chunk.payload.spot_name and chunk.payload.spot_name not in spots:
            spots.append(chunk.payload.spot_name)
        if len(spots) >= 5:
            break
    return spots
