from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.http import models

from rag.contracts.schemas import ChunkRecord


class QdrantVectorStore:
    def __init__(self, url: str, api_key: str | None, collection_name: str) -> None:
        self.collection_name = collection_name
        self.client = QdrantClient(url=url, api_key=api_key)

    def recreate_collection(self, vector_size: int) -> None:
        self.client.recreate_collection(
            collection_name=self.collection_name,
            vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
        )

    def ensure_collection(self, vector_size: int) -> None:
        collections = {item.name for item in self.client.get_collections().collections}
        if self.collection_name not in collections:
            self.client.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(size=vector_size, distance=models.Distance.COSINE),
            )

    def upsert(self, chunks: list[ChunkRecord], vectors: list[list[float]]) -> None:
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

    def search(self, query_vector: list[float], limit: int) -> list[ChunkRecord]:
        points = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit,
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
