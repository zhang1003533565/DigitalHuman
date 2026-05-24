from __future__ import annotations

from pathlib import Path
from datetime import datetime

from fastapi import HTTPException

from rag.config.settings import get_settings
from rag.contracts.schemas import IngestRequest, IngestResponse, KnowledgeDocumentInfo, QueryRequest, QueryResponse, RetrieveRequest, RetrieveResponse, UploadKnowledgeResponse
from rag.content.file_store import ensure_directory, is_supported_file_name, save_uploaded_file
from rag.graph.query_graph import RagQueryGraph, extract_related_spots
from rag.ingestion.chunker import ChunkingConfig, build_chunks
from rag.ingestion.parser import parse_document
from rag.llm import LlmConfig, ProviderBackedLlm, infer_provider_name
from rag.retrieval.embedder import BgeM3Embedder
from rag.retrieval.reranker import BgeReranker
from rag.retrieval.retriever import Retriever
from rag.retrieval.vectordb import QdrantVectorStore


class RagService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.embedder = BgeM3Embedder(self.settings.embedding_model_name)
        self.reranker = BgeReranker(self.settings.reranker_model_name)
        self.llm = ProviderBackedLlm(
            LlmConfig(
                provider=infer_provider_name(self.settings.llm_base_url),
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
        self.query_graph = RagQueryGraph(self.retriever, self.llm)

    def ingest(self, request: IngestRequest) -> IngestResponse:
        source_dir = Path(request.source_dir) if request.source_dir else self.settings.knowledge_base_dir
        if not source_dir.exists():
            raise HTTPException(status_code=400, detail=f"Knowledge base directory does not exist: {source_dir}")

        files = sorted(
            path
            for path in source_dir.glob(request.glob)
            if path.is_file() and path.suffix.lower() in {".docx", ".pdf", ".txt"}
        )
        return self.ingest_files(files, recreate_collection=request.recreate_collection)

    def ingest_files(self, files: list[Path], recreate_collection: bool) -> IngestResponse:
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
        if recreate_collection:
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

    def list_documents(self) -> list[KnowledgeDocumentInfo]:
        ensure_directory(self.settings.knowledge_base_dir)
        documents: list[KnowledgeDocumentInfo] = []
        for path in sorted(self.settings.knowledge_base_dir.iterdir()):
            if not path.is_file():
                continue
            stat = path.stat()
            documents.append(
                KnowledgeDocumentInfo(
                    file_name=path.name,
                    size_bytes=stat.st_size,
                    updated_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    supported=is_supported_file_name(path.name),
                )
            )
        return documents

    def upload_document(self, file_name: str, file_obj) -> UploadKnowledgeResponse:
        if not is_supported_file_name(file_name):
            raise HTTPException(status_code=400, detail="仅支持上传 docx、pdf、txt 文件")

        saved_path = save_uploaded_file(self.settings.knowledge_base_dir, file_name, file_obj)
        stat = saved_path.stat()
        return UploadKnowledgeResponse(
            file_name=saved_path.name,
            size_bytes=stat.st_size,
            updated_at=datetime.fromtimestamp(stat.st_mtime).isoformat(),
            supported=True,
        )

    def retrieve(self, request: RetrieveRequest) -> RetrieveResponse:
        chunks = self.retriever.retrieve(request.question, top_k=request.top_k)
        return RetrieveResponse(
            chunks=chunks,
            related_spots=extract_related_spots(chunks),
        )

    def query(self, request: QueryRequest) -> QueryResponse:
        return self.query_graph.run(request)
