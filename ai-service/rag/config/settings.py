from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = AI_SERVICE_ROOT.parent
SHARED_CONFIG_PATH = PROJECT_ROOT / "config" / "application-shared.properties"
load_dotenv(SHARED_CONFIG_PATH)
load_dotenv(AI_SERVICE_ROOT / ".env")


@dataclass(frozen=True)
class RagSettings:
    knowledge_base_dir: Path = Path(
        os.getenv("RAG_KNOWLEDGE_BASE_DIR")
        or os.getenv("rag.knowledge-base-dir")
        or Path(__file__).resolve().parents[2] / "knowledge-base"
    )
    qdrant_url: str = os.getenv("QDRANT_URL") or os.getenv("qdrant.url", "http://127.0.0.1:6333")
    qdrant_api_key: str | None = os.getenv("QDRANT_API_KEY")
    qdrant_collection: str = os.getenv("QDRANT_COLLECTION") or os.getenv("qdrant.collection", "scenic_kb")
    embedding_model_name: str = os.getenv("RAG_EMBEDDING_MODEL") or os.getenv("rag.embedding-model", "")
    reranker_model_name: str = os.getenv("RAG_RERANKER_MODEL") or os.getenv("rag.reranker-model", "")
    llm_timeout_seconds: int = 90
    chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE") or os.getenv("rag.chunk-size", "420"))
    chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP") or os.getenv("rag.chunk-overlap", "90"))
    retrieve_limit: int = int(os.getenv("RAG_RETRIEVE_LIMIT") or os.getenv("rag.retrieve-limit", "12"))
    rerank_limit: int = int(os.getenv("RAG_RERANK_LIMIT") or os.getenv("rag.rerank-limit", "5"))
    score_threshold: float = float(os.getenv("RAG_SCORE_THRESHOLD", "0.15"))


def get_settings() -> RagSettings:
    return RagSettings()


def validate_settings(settings: RagSettings) -> list[str]:
    warnings: list[str] = []
    if settings.chunk_overlap >= settings.chunk_size:
        warnings.append("RAG_CHUNK_OVERLAP 应小于 RAG_CHUNK_SIZE")
    if not settings.qdrant_url:
        warnings.append("QDRANT_URL 不能为空")
    if not settings.knowledge_base_dir.exists():
        warnings.append(f"知识库目录不存在，将在上传时创建：{settings.knowledge_base_dir}")
    return warnings
