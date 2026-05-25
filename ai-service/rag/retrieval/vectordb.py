from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import ResponseHandlingException
import math
import re

from rag.contracts.schemas import ChunkRecord


class QdrantVectorStore:
    def __init__(self, url: str, api_key: str | None, collection_name: str) -> None:
        self.collection_name = collection_name
        self.client = QdrantClient(url=url, api_key=api_key)

    def recreate_collection(self, vector_size: int) -> None:
        try:
            self.client.recreate_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
            )
        except ResponseHandlingException as exc:
            raise RuntimeError(f"Qdrant 连接失败，请确认向量库已启动并可访问：{exc}") from exc

    def ensure_collection(self, vector_size: int) -> None:
        try:
            collections = {item.name for item in self.client.get_collections().collections}
            if self.collection_name not in collections:
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
                )
        except ResponseHandlingException as exc:
            raise RuntimeError(f"Qdrant 连接失败，请确认向量库已启动并可访问：{exc}") from exc

    def collection_status(self) -> dict[str, object]:
        collections = {item.name for item in self.client.get_collections().collections}
        if self.collection_name not in collections:
            return {"exists": False, "name": self.collection_name}
        info = self.client.get_collection(self.collection_name)
        vector_size = None
        vectors_config = getattr(info.config.params, "vectors", None)
        if hasattr(vectors_config, "size"):
            vector_size = vectors_config.size
        return {
            "exists": True,
            "name": self.collection_name,
            "pointsCount": getattr(info, "points_count", None),
            "vectorsCount": getattr(info, "vectors_count", None),
            "vectorSize": vector_size,
        }

    def upsert(self, chunks: list[ChunkRecord], vectors: list[list[float]]) -> None:
        try:
            self.client.upsert(
                collection_name=self.collection_name,
                wait=True,
                points=[
                    models.PointStruct(
                        id=chunk.id,
                        vector=vector,
                        payload={
                            "text": chunk.text,
                            **chunk.payload.model_dump(),
                        },
                    )
                    for chunk, vector in zip(chunks, vectors)
                ],
            )
        except ResponseHandlingException as exc:
            raise RuntimeError(f"Qdrant 写入失败，请确认向量库已启动并可访问：{exc}") from exc

    def search(self, query_vector: list[float], limit: int, metadata_filter: dict[str, object] | None = None) -> list[ChunkRecord]:
        points = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit,
            query_filter=build_metadata_filter(metadata_filter),
            with_payload=True,
        )
        results: list[ChunkRecord] = []
        for point in points:
            payload = dict(point.payload or {})
            text = str(payload.pop("text", ""))
            results.append(
                ChunkRecord(
                    id=str(point.id),
                    text=text,
                    score=float(point.score),
                    payload=payload,
                )
            )
        return results

    def keyword_search(self, query: str, limit: int, metadata_filter: dict[str, object] | None = None) -> list[ChunkRecord]:
        points, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=build_metadata_filter(metadata_filter),
            limit=5000,
            with_payload=True,
            with_vectors=False,
        )
        terms = tokenize_query(query)
        if not terms:
            return []
        documents: list[tuple[object, dict, str, list[str]]] = []
        document_frequency: dict[str, int] = {term: 0 for term in terms}
        for point in points:
            payload = dict(point.payload or {})
            text = str(payload.get("text", ""))
            tokens = tokenize_query(text)
            token_set = set(tokens)
            for term in terms:
                if term in token_set:
                    document_frequency[term] += 1
            documents.append((point.id, payload, text, tokens))
        total = max(1, len(documents))
        scored: list[ChunkRecord] = []
        for point_id, payload, text, tokens in documents:
            if not tokens:
                continue
            score = 0.0
            length_norm = 1.0 + len(tokens) / 200.0
            for term in terms:
                tf = tokens.count(term)
                if tf <= 0:
                    continue
                idf = math.log((total + 1) / (document_frequency.get(term, 0) + 1)) + 1
                score += (tf * idf) / length_norm
            if score <= 0:
                continue
            next_payload = dict(payload)
            next_payload.pop("text", None)
            scored.append(ChunkRecord(id=str(point_id), text=text, score=score, payload=next_payload))
        return sorted(scored, key=lambda item: item.score or 0, reverse=True)[:limit]

    def delete_by_source_file(self, file_name: str) -> int | None:
        points, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="source_file",
                        match=models.MatchValue(value=file_name),
                    )
                ]
            ),
            limit=10000,
            with_payload=False,
            with_vectors=False,
        )
        point_ids = [point.id for point in points]
        if not point_ids:
            return 0
        self.client.delete(
            collection_name=self.collection_name,
            points_selector=models.PointIdsList(points=point_ids),
            wait=True,
        )
        return len(point_ids)

    def list_by_source_file(self, file_name: str, limit: int = 1000) -> list[ChunkRecord]:
        points, _ = self.client.scroll(
            collection_name=self.collection_name,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="source_file",
                        match=models.MatchValue(value=file_name),
                    )
                ]
            ),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )
        chunks: list[ChunkRecord] = []
        for point in points:
            payload = dict(point.payload or {})
            text = str(payload.pop("text", ""))
            chunks.append(
                ChunkRecord(
                    id=str(point.id),
                    text=text,
                    score=None,
                    payload=payload,
                )
            )
        return sorted(chunks, key=lambda chunk: chunk.payload.chunk_index)

    def set_chunk_disabled(self, chunk_id: str, disabled: bool) -> bool:
        self.client.set_payload(
            collection_name=self.collection_name,
            payload={"disabled": disabled},
            points=[chunk_id],
            wait=True,
        )
        return True


def build_metadata_filter(metadata_filter: dict[str, object] | None):
    conditions = []
    disabled_condition = models.FieldCondition(key="disabled", match=models.MatchValue(value=True))
    if not metadata_filter:
        return models.Filter(must_not=[disabled_condition])
    for key in ("source_file", "spot_name", "content_type"):
        value = metadata_filter.get(key)
        if value:
            conditions.append(models.FieldCondition(key=key, match=models.MatchValue(value=str(value))))
    for alias in ("scenic_area", "spot", "file_type"):
        value = metadata_filter.get(alias)
        if not value:
            continue
        key = {"scenic_area": "tags", "spot": "spot_name", "file_type": "content_type"}[alias]
        conditions.append(models.FieldCondition(key=key, match=models.MatchValue(value=str(value))))
    tags = metadata_filter.get("tags")
    if isinstance(tags, list):
        for tag in tags:
            conditions.append(models.FieldCondition(key="tags", match=models.MatchValue(value=str(tag))))
    return models.Filter(must=conditions, must_not=[disabled_condition])


def tokenize_query(text: str) -> list[str]:
    lowered = text.lower()
    words = re.findall(r"[a-z0-9]+|[\u4e00-\u9fff]{2,}", lowered)
    char_terms = [char for char in lowered if "\u4e00" <= char <= "\u9fff"]
    return words + char_terms
