from __future__ import annotations

import math
import re
from functools import cached_property

from rag.core.schemas import ChunkRecord


class BgeReranker:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    @cached_property
    def _model(self):
        try:
            from FlagEmbedding import FlagReranker
        except ImportError:
            return None
        return FlagReranker(self.model_name, use_fp16=False)

    def rerank(self, query: str, chunks: list[ChunkRecord], limit: int) -> list[ChunkRecord]:
        if not chunks:
            return []

        model = self._model
        if model is None:
            return self._fallback_rerank(query, chunks, limit)

        pairs = [[query, chunk.text] for chunk in chunks]
        scores = model.compute_score(pairs)
        for chunk, score in zip(chunks, scores):
            chunk.score = float(score)
        reranked = sorted(chunks, key=lambda item: item.score if item.score is not None else -math.inf, reverse=True)
        return reranked[:limit]

    def _fallback_rerank(self, query: str, chunks: list[ChunkRecord], limit: int) -> list[ChunkRecord]:
        query_terms = set(re.findall(r"[A-Za-z0-9一-龥]+", query.lower()))
        for chunk in chunks:
            text_terms = set(re.findall(r"[A-Za-z0-9一-龥]+", chunk.text.lower()))
            overlap = len(query_terms & text_terms)
            chunk.score = float(overlap)
        return sorted(chunks, key=lambda item: item.score or 0.0, reverse=True)[:limit]
