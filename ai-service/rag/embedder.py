from __future__ import annotations

from functools import cached_property


class BgeM3Embedder:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name

    @cached_property
    def _model(self):
        try:
            from FlagEmbedding import BGEM3FlagModel
        except ImportError as exc:
            raise RuntimeError(
                "FlagEmbedding is required for BGE-M3 embeddings. Install ai-service requirements first."
            ) from exc
        return BGEM3FlagModel(self.model_name, use_fp16=False)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        result = self._model.encode(texts, batch_size=min(8, len(texts)), max_length=2048)
        return [vector.tolist() if hasattr(vector, "tolist") else list(vector) for vector in result["dense_vecs"]]

    def embed_query(self, text: str) -> list[float]:
        return self.embed_documents([text])[0]
