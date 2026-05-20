from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(AI_SERVICE_ROOT / ".env")


@dataclass(frozen=True)
class RagSettings:
    knowledge_base_dir: Path = Path(
        os.getenv("RAG_KNOWLEDGE_BASE_DIR", Path(__file__).resolve().parents[2] / "knowledge-base")
    )
    qdrant_url: str = os.getenv("QDRANT_URL", "http://127.0.0.1:6333")
    qdrant_api_key: str | None = os.getenv("QDRANT_API_KEY")
    qdrant_collection: str = os.getenv("QDRANT_COLLECTION", "scenic_kb")
    embedding_model_name: str = os.getenv("RAG_EMBEDDING_MODEL", "BAAI/bge-m3")
    reranker_model_name: str = os.getenv("RAG_RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
    llm_base_url: str | None = os.getenv("RAG_LLM_BASE_URL")
    llm_api_key: str | None = os.getenv("RAG_LLM_API_KEY")
    llm_model: str | None = os.getenv("RAG_LLM_MODEL")
    llm_timeout_seconds: int = int(os.getenv("RAG_LLM_TIMEOUT_SECONDS", "90"))
    chunk_size: int = int(os.getenv("RAG_CHUNK_SIZE", "420"))
    chunk_overlap: int = int(os.getenv("RAG_CHUNK_OVERLAP", "90"))
    retrieve_limit: int = int(os.getenv("RAG_RETRIEVE_LIMIT", "12"))
    rerank_limit: int = int(os.getenv("RAG_RERANK_LIMIT", "5"))
    score_threshold: float = float(os.getenv("RAG_SCORE_THRESHOLD", "0.15"))


def get_settings() -> RagSettings:
    return RagSettings()
