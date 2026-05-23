from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.http import models

from rag.core.schemas import ChunkRecord


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
