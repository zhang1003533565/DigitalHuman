from __future__ import annotations

import json
from pathlib import Path

from pydantic import BaseModel, Field


class RetrievalConfig(BaseModel):
    top_k: int = Field(default=5, alias="topK")
    retrieve_limit: int = Field(default=12, alias="retrieveLimit")
    rerank_limit: int = Field(default=5, alias="rerankLimit")
    score_threshold: float = Field(default=0.15, alias="scoreThreshold")
    hybrid_enabled: bool = Field(default=True, alias="hybridEnabled")
    reranker_enabled: bool = Field(default=True, alias="rerankerEnabled")


def config_path() -> Path:
    return Path(__file__).resolve().parents[1] / ".runtime" / "retrieval_config.json"


def load_retrieval_config() -> RetrievalConfig:
    path = config_path()
    if not path.exists():
        return RetrievalConfig()
    try:
        return RetrievalConfig.model_validate(json.loads(path.read_text(encoding="utf-8")))
    except Exception:
        return RetrievalConfig()


def save_retrieval_config(config: RetrievalConfig) -> RetrievalConfig:
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(config.model_dump(by_alias=True), ensure_ascii=False, indent=2), encoding="utf-8")
    return config
