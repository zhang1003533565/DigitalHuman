from __future__ import annotations

from rag.embedder import BgeM3Embedder
from rag.reranker import BgeReranker
from rag.schemas import ChunkRecord
from rag.vectordb import QdrantVectorStore


class Retriever:
    def __init__(
        self,
        vector_store: QdrantVectorStore,
        embedder: BgeM3Embedder,
        reranker: BgeReranker,
        retrieve_limit: int,
        rerank_limit: int,
    ) -> None:
        self.vector_store = vector_store
        self.embedder = embedder
        self.reranker = reranker
        self.retrieve_limit = retrieve_limit
        self.rerank_limit = rerank_limit

    def retrieve(self, question: str, top_k: int | None = None) -> list[ChunkRecord]:
        query_vector = self.embedder.embed_query(question)
        dense_hits = self.vector_store.search(query_vector, limit=top_k or self.retrieve_limit)
        return self.reranker.rerank(question, dense_hits, limit=min(top_k or self.rerank_limit, self.rerank_limit))
