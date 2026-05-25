from __future__ import annotations

from functools import cached_property

from model_capabilities.embedding.service import embed_query, embed_texts


class BgeM3Embedder:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    @cached_property
    def _model(self):
        try:
            from FlagEmbedding import BGEM3FlagModel
        except ImportError as exc:
            raise RuntimeError(
                f"FlagEmbedding/BGE-M3 embedding dependency is unavailable: {exc}"
            ) from exc
        return BGEM3FlagModel(self.model_name, use_fp16=False)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        result = self._model.encode(texts, batch_size=min(8, len(texts)), max_length=2048)
        return [vector.tolist() if hasattr(vector, "tolist") else list(vector) for vector in result["dense_vecs"]]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]

    def status(self) -> dict[str, str]:
        try:
            from FlagEmbedding import BGEM3FlagModel  # noqa: F401
            return {"mode": "bge-m3", "model": self.model_name}
        except ImportError as exc:
            return {"mode": "unavailable", "model": self.model_name, "reason": str(exc)[:240]}


class ProviderEmbedder:
    def __init__(self, provider: str, model_name: str) -> None:
        self.provider = provider
        self.model_name = model_name

    @cached_property
    def _status(self):
        return {"mode": "provider", "provider": self.provider, "model": self.model_name}

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return embed_texts(self.provider, self.model_name, texts)

    def embed_query(self, text: str) -> list[float]:
        return embed_query(self.provider, self.model_name, text)

    def status(self) -> dict[str, str]:
        return self._status
