from __future__ import annotations

from rag.contracts.schemas import ChunkRecord
from rag.retrieval.config_store import load_retrieval_config
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

    def retrieve(self, question: str, top_k: int | None = None, metadata_filter: dict[str, object] | None = None) -> list[ChunkRecord]:
        return self.retrieve_with_stages(question, top_k=top_k, metadata_filter=metadata_filter)["reranked"]

    def retrieve_with_stages(self, question: str, top_k: int | None = None, metadata_filter: dict[str, object] | None = None) -> dict[str, list[ChunkRecord]]:
        config = load_retrieval_config()
        effective_top_k = top_k or config.top_k or self.retrieve_limit
        retrieve_limit = max(effective_top_k, config.retrieve_limit or self.retrieve_limit)
        query_vector = self.embedder.embed_query(question)
        dense_hits = self.vector_store.search(query_vector, limit=retrieve_limit, metadata_filter=metadata_filter)
        if config.hybrid_enabled:
            apply_keyword_bonus(question, dense_hits)
        rerank_input = [chunk.model_copy(deep=True) for chunk in dense_hits]
        rerank_limit = min(effective_top_k, config.rerank_limit or self.rerank_limit)
        reranked = self.reranker.rerank(question, rerank_input, limit=rerank_limit) if config.reranker_enabled else sorted(rerank_input, key=lambda item: item.score or 0, reverse=True)[:rerank_limit]
        return {
            "dense": dense_hits,
            "reranked": reranked,
        }


def apply_keyword_bonus(question: str, chunks: list[ChunkRecord]) -> None:
    terms = {char for char in question if char.strip() and char not in "，。！？；：、的了呢吗"}
    if not terms:
        return
    for chunk in chunks:
        overlap = sum(1 for char in terms if char in chunk.text)
        chunk.score = float(chunk.score or 0) + overlap * 0.001
