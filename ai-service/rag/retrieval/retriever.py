from __future__ import annotations

from rag.contracts.schemas import ChunkRecord
from rag.retrieval.embedder import BgeM3Embedder
from rag.retrieval.reranker import BgeReranker
from rag.retrieval.vectordb import QdrantVectorStore


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
        return self.retrieve_with_stages(question, top_k=top_k)["reranked"]

    def retrieve_with_stages(self, question: str, top_k: int | None = None) -> dict[str, list[ChunkRecord]]:
        query_vector = self.embedder.embed_query(question)
        dense_hits = self.vector_store.search(query_vector, limit=top_k or self.retrieve_limit)
        rerank_input = [chunk.model_copy(deep=True) for chunk in dense_hits]
        reranked = self.reranker.rerank(question, rerank_input, limit=min(top_k or self.rerank_limit, self.rerank_limit))
        return {
            "dense": dense_hits,
            "reranked": reranked,
        }
