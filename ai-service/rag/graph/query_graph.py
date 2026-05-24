from __future__ import annotations

from typing import Literal, TypedDict

from langgraph.graph import END, StateGraph

from rag.contracts.schemas import ChunkPayload, ChunkRecord, QueryRequest, QueryResponse
from rag.generation.prompts import build_grounded_answer
from rag.llm import ProviderBackedLlm
from rag.retrieval.retriever import Retriever


class RagQueryState(TypedDict, total=False):
    question: str
    interest: str | None
    top_k: int | None
    chunks: list[ChunkRecord]
    answer: str | None
    related_spots: list[str]
    sources: list[ChunkPayload]


class RagQueryGraph:
    def __init__(self, retriever: Retriever, llm: ProviderBackedLlm) -> None:
        self.retriever = retriever
        self.llm = llm
        self.graph = self._build_graph()

    def run(self, request: QueryRequest) -> QueryResponse:
        result = self.graph.invoke(
            {
                "question": request.question,
                "interest": request.interest,
                "top_k": request.top_k,
            }
        )
        chunks = result.get("chunks", [])
        return QueryResponse(
            answer=result.get("answer") or "",
            related_spots=result.get("related_spots", extract_related_spots(chunks)),
            sources=result.get("sources", [chunk.payload for chunk in chunks]),
            chunks=chunks,
        )

    def _build_graph(self):
        graph = StateGraph(RagQueryState)
        graph.add_node("retrieve", self._retrieve)
        graph.add_node("generate", self._generate)
        graph.add_node("fallback_answer", self._fallback_answer)
        graph.add_node("prepare_response", self._prepare_response)

        graph.set_entry_point("retrieve")
        graph.add_edge("retrieve", "generate")
        graph.add_conditional_edges(
            "generate",
            should_use_fallback,
            {
                "fallback": "fallback_answer",
                "complete": "prepare_response",
            },
        )
        graph.add_edge("fallback_answer", "prepare_response")
        graph.add_edge("prepare_response", END)
        return graph.compile()

    def _retrieve(self, state: RagQueryState) -> RagQueryState:
        chunks = self.retriever.retrieve(state["question"], top_k=state.get("top_k"))
        return {"chunks": chunks}

    def _generate(self, state: RagQueryState) -> RagQueryState:
        chunks = state.get("chunks", [])
        answer = self.llm.generate_answer(state["question"], state.get("interest"), chunks)
        return {"answer": answer}

    def _fallback_answer(self, state: RagQueryState) -> RagQueryState:
        return {
            "answer": build_grounded_answer(
                state["question"],
                state.get("chunks", []),
            )
        }

    def _prepare_response(self, state: RagQueryState) -> RagQueryState:
        chunks = state.get("chunks", [])
        return {
            "related_spots": extract_related_spots(chunks),
            "sources": [chunk.payload for chunk in chunks],
        }


def should_use_fallback(state: RagQueryState) -> Literal["fallback", "complete"]:
    if state.get("answer"):
        return "complete"
    return "fallback"


def extract_related_spots(chunks: list[ChunkRecord]) -> list[str]:
    spots: list[str] = []
    for chunk in chunks:
        if chunk.payload.spot_name and chunk.payload.spot_name not in spots:
            spots.append(chunk.payload.spot_name)
        if len(spots) >= 5:
            break
    return spots
