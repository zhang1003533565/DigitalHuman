from __future__ import annotations

import sqlite3
import time
import uuid
from pathlib import Path
from typing import Literal, TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import interrupt

from rag.contracts.schemas import ChunkPayload, ChunkRecord, QueryRequest, QueryResponse, RetrievalAttempt
from rag.generation.prompts import build_grounded_answer
from rag.graph.memory_store import ConversationMemoryStore
from rag.llm import ProviderBackedLlm, get_prompt_version
from rag.retrieval.config_store import load_retrieval_config
from rag.retrieval.retriever import Retriever


class RagQueryState(TypedDict, total=False):
    trace_id: str
    question: str
    rewritten_question: str
    interest: str | None
    top_k: int | None
    metadata_filter: dict[str, object] | None
    session_id: str
    enable_human_review: bool
    history: list[dict[str, str]]
    chunks: list[dict[str, object]]
    answer: str | None
    context_sufficient: bool
    context_reason: str | None
    quality_passed: bool
    quality_issues: list[str]
    citations_valid: bool
    citation_issues: list[str]
    review_required: bool
    review_reason: str | None
    related_spots: list[str]
    sources: list[dict[str, object]]
    graph_steps: list[str]
    retrieval_attempts: int
    retrieval_trace: list[dict[str, object]]
    node_timings_ms: dict[str, float]
    low_confidence: bool
    low_confidence_reason: str | None
    provider_status: str | None
    provider_error: str | None


class RagQueryGraph:
    def __init__(self, retriever: Retriever, llm: ProviderBackedLlm, score_threshold: float = 0.15) -> None:
        self.retriever = retriever
        self.llm = llm
        self.score_threshold = score_threshold
        self.runtime_dir = Path(__file__).resolve().parents[1] / ".runtime"
        self.memory_store = ConversationMemoryStore(self.runtime_dir / "rag_memory.sqlite")
        self._checkpoint_connection: sqlite3.Connection | None = None
        self.checkpointer = self._build_checkpointer()
        self.graph = self._build_graph()

    def run(self, request: QueryRequest) -> QueryResponse:
        session_id = request.session_id or "anonymous"
        trace_id = request.trace_id or f"rag-{uuid.uuid4()}"
        started = time.perf_counter()
        result = self.graph.invoke(
            {
                "trace_id": trace_id,
                "question": request.question,
                "interest": request.interest,
                "top_k": request.top_k,
                "metadata_filter": request.metadata_filter,
                "session_id": session_id,
                "enable_human_review": request.enable_human_review,
                "graph_steps": [],
                "retrieval_attempts": 0,
            "retrieval_trace": [],
            "node_timings_ms": {},
            "provider_status": "not_called",
        },
            config={"configurable": {"thread_id": session_id}},
        )
        total_duration_ms = elapsed_ms(started)
        if "__interrupt__" in result:
            interrupt_value = result["__interrupt__"][0].value
            return QueryResponse(
                traceId=trace_id,
                answer="当前回答需要人工审核后再返回。",
                related_spots=[],
                sources=[],
                chunks=[],
                rewrittenQuestion=None,
                contextSufficient=False,
                contextReason=str(interrupt_value.get("reason") or "需要人工审核"),
                qualityPassed=False,
                qualityIssues=["人工审核中断"],
                citationsValid=False,
                citationIssues=[],
                reviewRequired=True,
                reviewReason=str(interrupt_value.get("reason") or "需要人工审核"),
                graphSteps=["human_review_interrupt"],
                retrievalAttempts=0,
                totalDurationMs=total_duration_ms,
                lowConfidence=True,
                lowConfidenceReason=str(interrupt_value.get("reason") or "需要人工审核"),
                promptVersion=get_prompt_version(),
            )

        chunks = deserialize_chunks(result.get("chunks", []))
        answer = result.get("answer") or ""
        self._append_memory(session_id, request.question, answer)
        low_confidence, low_confidence_reason = build_low_confidence(result, chunks, answer)
        return QueryResponse(
            traceId=trace_id,
            answer=answer,
            related_spots=result.get("related_spots", extract_related_spots(chunks)),
            sources=deserialize_payloads(result.get("sources", [])) or [chunk.payload for chunk in chunks],
            chunks=chunks,
            rewrittenQuestion=result.get("rewritten_question"),
            contextSufficient=result.get("context_sufficient", True),
            contextReason=result.get("context_reason"),
            qualityPassed=result.get("quality_passed", True),
            qualityIssues=result.get("quality_issues", []),
            citationsValid=result.get("citations_valid", True),
            citationIssues=result.get("citation_issues", []),
            reviewRequired=result.get("review_required", False),
            reviewReason=result.get("review_reason"),
            graphSteps=result.get("graph_steps", []),
            retrievalAttempts=result.get("retrieval_attempts", 1),
            retrievalTrace=deserialize_retrieval_attempts(result.get("retrieval_trace", [])),
            nodeTimingsMs=result.get("node_timings_ms", {}),
            totalDurationMs=total_duration_ms,
            lowConfidence=low_confidence,
            lowConfidenceReason=low_confidence_reason,
            promptVersion=get_prompt_version(),
            providerStatus=result.get("provider_status"),
            providerError=result.get("provider_error"),
        )

    def _build_graph(self):
        graph = StateGraph(RagQueryState)
        graph.add_node("load_memory", self._load_memory)
        graph.add_node("rewrite_query", self._rewrite_query)
        graph.add_node("retrieve", self._retrieve)
        graph.add_node("judge_context", self._judge_context)
        graph.add_node("second_retrieve", self._second_retrieve)
        graph.add_node("generate", self._generate)
        graph.add_node("fallback_answer", self._fallback_answer)
        graph.add_node("answer_quality_check", self._answer_quality_check)
        graph.add_node("citation_validation", self._citation_validation)
        graph.add_node("human_review", self._human_review)
        graph.add_node("prepare_response", self._prepare_response)

        graph.set_entry_point("load_memory")
        graph.add_edge("load_memory", "rewrite_query")
        graph.add_edge("rewrite_query", "retrieve")
        graph.add_edge("retrieve", "judge_context")
        graph.add_conditional_edges(
            "judge_context",
            route_after_context_judge,
            {
                "second_retrieve": "second_retrieve",
                "generate": "generate",
            },
        )
        graph.add_edge("second_retrieve", "generate")
        graph.add_edge("generate", "answer_quality_check")
        graph.add_conditional_edges(
            "answer_quality_check",
            route_after_quality_check,
            {
                "fallback": "fallback_answer",
                "citation_validation": "citation_validation",
            },
        )
        graph.add_edge("fallback_answer", "citation_validation")
        graph.add_conditional_edges(
            "citation_validation",
            route_after_citation_validation,
            {
                "human_review": "human_review",
                "prepare_response": "prepare_response",
            },
        )
        graph.add_edge("human_review", "prepare_response")
        graph.add_edge("prepare_response", END)
        return graph.compile(checkpointer=self.checkpointer)

    def _load_memory(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        session_id = state.get("session_id") or "anonymous"
        return {
            "history": self.memory_store.load(session_id, limit=8),
            "graph_steps": add_step(state, "load_memory"),
            "node_timings_ms": add_timing(state, "load_memory", started),
        }

    def _rewrite_query(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        question = state["question"]
        rewritten = self.llm.rewrite_question(question, state.get("history", []), state.get("interest"))
        if not rewritten:
            rewritten = heuristic_rewrite(question, state.get("history", []))
        return {
            "rewritten_question": rewritten,
            "graph_steps": add_step(state, "rewrite_query"),
            "node_timings_ms": add_timing(state, "rewrite_query", started),
        }

    def _retrieve(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        query = state.get("rewritten_question") or state["question"]
        stages = self.retriever.retrieve_with_stages(query, top_k=state.get("top_k"), metadata_filter=state.get("metadata_filter"))
        chunks = stages["reranked"]
        return {
            "chunks": serialize_chunks(chunks),
            "retrieval_attempts": state.get("retrieval_attempts", 0) + 1,
            "retrieval_trace": add_retrieval_attempt(state, "primary", query, stages),
            "graph_steps": add_step(state, "retrieve"),
            "node_timings_ms": add_timing(state, "retrieve", started),
        }

    def _judge_context(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        chunks = deserialize_chunks(state.get("chunks", []))
        retrieval_config = load_retrieval_config()
        sufficient, reason = judge_context_sufficiency(
            state.get("rewritten_question") or state["question"],
            chunks,
            retrieval_config.score_threshold or self.score_threshold,
        )
        return {
            "context_sufficient": sufficient,
            "context_reason": reason,
            "graph_steps": add_step(state, "judge_context"),
            "node_timings_ms": add_timing(state, "judge_context", started),
        }

    def _second_retrieve(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        query = expand_query(state.get("rewritten_question") or state["question"], state.get("interest"))
        limit = max(state.get("top_k") or 5, 8)
        stages = self.retriever.retrieve_with_stages(query, top_k=limit, metadata_filter=state.get("metadata_filter"))
        extra_chunks = stages["reranked"]
        merged = merge_chunks(deserialize_chunks(state.get("chunks", [])), extra_chunks)
        return {
            "rewritten_question": query,
            "chunks": serialize_chunks(merged),
            "context_sufficient": bool(merged),
            "context_reason": "二次检索后已有可用片段" if merged else "二次检索仍未召回可用片段",
            "retrieval_attempts": state.get("retrieval_attempts", 0) + 1,
            "retrieval_trace": add_retrieval_attempt(state, "second", query, stages),
            "graph_steps": add_step(state, "second_retrieve"),
            "node_timings_ms": add_timing(state, "second_retrieve", started),
        }

    def _generate(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        chunks = deserialize_chunks(state.get("chunks", []))
        try:
            answer = self.llm.generate_answer(
                state.get("rewritten_question") or state["question"],
                state.get("interest"),
                chunks,
            )
            provider_status = "success" if answer else "skipped"
            provider_error = None
        except Exception as exc:
            answer = None
            provider_status = classify_provider_error(exc)
            provider_error = str(exc)
        return {
            "answer": answer,
            "provider_status": provider_status,
            "provider_error": provider_error,
            "graph_steps": add_step(state, "generate"),
            "node_timings_ms": add_timing(state, "generate", started),
        }

    def _fallback_answer(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        chunks = deserialize_chunks(state.get("chunks", []))
        answer = build_grounded_answer(
            state.get("rewritten_question") or state["question"],
            chunks,
        )
        return {
            "answer": answer,
            "quality_passed": bool(chunks),
            "graph_steps": add_step(state, "fallback_answer"),
            "node_timings_ms": add_timing(state, "fallback_answer", started),
        }

    def _answer_quality_check(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        answer = (state.get("answer") or "").strip()
        chunks = deserialize_chunks(state.get("chunks", []))
        quality_issues = check_answer_quality(answer, chunks)
        return {
            "quality_passed": not quality_issues,
            "quality_issues": quality_issues,
            "graph_steps": add_step(state, "answer_quality_check"),
            "node_timings_ms": add_timing(state, "answer_quality_check", started),
        }

    def _citation_validation(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        answer = state.get("answer") or ""
        chunks = deserialize_chunks(state.get("chunks", []))
        citations_valid, citation_issues = validate_citations(answer, chunks)
        if chunks and not citations_valid:
            answer = append_citations(answer, chunks)
            citations_valid, citation_issues = validate_citations(answer, chunks)
        return {
            "answer": answer,
            "citations_valid": citations_valid,
            "citation_issues": citation_issues,
            "graph_steps": add_step(state, "citation_validation"),
            "node_timings_ms": add_timing(state, "citation_validation", started),
        }

    def _human_review(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        reason = build_review_reason(state)
        if state.get("enable_human_review") and reason:
            interrupt({"reason": reason, "question": state["question"], "answer": state.get("answer")})
        return {
            "review_required": bool(reason),
            "review_reason": reason,
            "graph_steps": add_step(state, "human_review"),
            "node_timings_ms": add_timing(state, "human_review", started),
        }

    def _prepare_response(self, state: RagQueryState) -> RagQueryState:
        started = time.perf_counter()
        chunks = deserialize_chunks(state.get("chunks", []))
        return {
            "related_spots": extract_related_spots(chunks),
            "sources": [chunk.payload.model_dump() for chunk in chunks],
            "graph_steps": add_step(state, "prepare_response"),
            "node_timings_ms": add_timing(state, "prepare_response", started),
        }

    def _append_memory(self, session_id: str, question: str, answer: str) -> None:
        self.memory_store.append(session_id, question, answer)

    def _build_checkpointer(self):
        checkpoint_path = self.runtime_dir / "rag_checkpoints.sqlite"
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            from langgraph.checkpoint.sqlite import SqliteSaver

            self._checkpoint_connection = sqlite3.connect(str(checkpoint_path), check_same_thread=False)
            checkpointer = SqliteSaver(self._checkpoint_connection)
            setup = getattr(checkpointer, "setup", None)
            if callable(setup):
                setup()
            return checkpointer
        except Exception:
            return MemorySaver()


def serialize_chunks(chunks: list[ChunkRecord]) -> list[dict[str, object]]:
    return [chunk.model_dump() for chunk in chunks]


def deserialize_chunks(raw_chunks: list[ChunkRecord | dict[str, object]] | None) -> list[ChunkRecord]:
    if not raw_chunks:
        return []
    return [
        chunk if isinstance(chunk, ChunkRecord) else ChunkRecord.model_validate(chunk)
        for chunk in raw_chunks
    ]


def deserialize_payloads(raw_payloads: list[ChunkPayload | dict[str, object]] | None) -> list[ChunkPayload]:
    if not raw_payloads:
        return []
    return [
        payload if isinstance(payload, ChunkPayload) else ChunkPayload.model_validate(payload)
        for payload in raw_payloads
    ]


def deserialize_retrieval_attempts(raw_attempts: list[RetrievalAttempt | dict[str, object]] | None) -> list[RetrievalAttempt]:
    if not raw_attempts:
        return []
    return [
        attempt if isinstance(attempt, RetrievalAttempt) else RetrievalAttempt.model_validate(attempt)
        for attempt in raw_attempts
    ]


def route_after_context_judge(state: RagQueryState) -> Literal["second_retrieve", "generate"]:
    if state.get("context_sufficient"):
        return "generate"
    return "second_retrieve"


def route_after_quality_check(state: RagQueryState) -> Literal["fallback", "citation_validation"]:
    if state.get("answer") and state.get("quality_passed"):
        return "citation_validation"
    return "fallback"


def route_after_citation_validation(state: RagQueryState) -> Literal["human_review", "prepare_response"]:
    if build_review_reason(state):
        return "human_review"
    return "prepare_response"


def add_step(state: RagQueryState, step: str) -> list[str]:
    return [*state.get("graph_steps", []), step]


def add_timing(state: RagQueryState, step: str, started: float) -> dict[str, float]:
    return {
        **state.get("node_timings_ms", {}),
        step: elapsed_ms(started),
    }


def elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 2)


def add_retrieval_attempt(
    state: RagQueryState,
    name: str,
    query: str,
    stages: dict[str, list[ChunkRecord]],
) -> list[dict[str, object]]:
    return [
        *state.get("retrieval_trace", []),
        {
            "name": name,
            "query": query,
            "dense": {
                "name": "dense",
                "query": query,
                "chunks": serialize_chunks(stages.get("dense", [])),
            },
            "reranked": {
                "name": "reranked",
                "query": query,
                "chunks": serialize_chunks(stages.get("reranked", [])),
            },
        },
    ]


def heuristic_rewrite(question: str, history: list[dict[str, str]]) -> str:
    if not history:
        return question
    last_user_questions = [item["content"] for item in history if item.get("role") == "user"]
    if not last_user_questions:
        return question
    if any(token in question for token in ("它", "这里", "这个", "那里", "附近", "怎么去")):
        return f"{last_user_questions[-1]}；追问：{question}"
    return question


def expand_query(question: str, interest: str | None) -> str:
    if interest:
        return f"{question} {interest} 景点 介绍 路线 游览"
    return f"{question} 景点 介绍 路线 游览"


def judge_context_sufficiency(question: str, chunks: list[ChunkRecord], score_threshold: float) -> tuple[bool, str | None]:
    if not chunks:
        return False, "没有召回任何知识片段"
    scored_chunks = [chunk for chunk in chunks if chunk.score is not None]
    if scored_chunks and all((chunk.score or 0) < score_threshold for chunk in scored_chunks):
        return False, f"召回片段分数均低于阈值 {score_threshold}"
    if len(chunks) >= 2:
        return True, None
    question_terms = {char for char in question if char.strip() and char not in "，。！？；：、的了呢吗"}
    if not question_terms:
        return True, None
    overlap = sum(1 for char in question_terms if char in chunks[0].text)
    required_overlap = max(2, min(6, len(question_terms) // 3))
    if overlap >= required_overlap:
        return True, None
    return False, f"唯一片段与问题关键词重合不足，命中 {overlap}/{required_overlap}"


def merge_chunks(primary: list[ChunkRecord], secondary: list[ChunkRecord]) -> list[ChunkRecord]:
    seen: set[str] = set()
    merged: list[ChunkRecord] = []
    for chunk in [*primary, *secondary]:
        if chunk.id in seen:
            continue
        seen.add(chunk.id)
        merged.append(chunk)
    return merged


def check_answer_quality(answer: str, chunks: list[ChunkRecord]) -> list[str]:
    issues: list[str] = []
    if not chunks:
        issues.append("没有知识片段支撑答案")
    if not answer:
        issues.append("模型没有返回答案")
        return issues
    if len(answer) < 12:
        issues.append("答案过短")
    if chunks and "知识库暂未覆盖" in answer and len(chunks) >= 2:
        issues.append("有可用片段但答案仍声明知识不足")
    return issues


def validate_citations(answer: str, chunks: list[ChunkRecord]) -> tuple[bool, list[str]]:
    if not chunks:
        return True, []
    if "来源：" not in answer:
        return False, ["缺少“来源：文件名 / 标题”引用"]
    known_files = {chunk.payload.source_file for chunk in chunks}
    source_lines = [line.strip() for line in answer.splitlines() if line.strip().startswith("来源：")]
    if not source_lines:
        return False, ["没有独立来源行"]

    issues: list[str] = []
    has_known_file = False
    for line in source_lines:
        if " / " not in line:
            issues.append(f"来源行缺少标题路径分隔符：{line}")
        if any(source_file in line for source_file in known_files):
            has_known_file = True
    if not has_known_file:
        issues.append("来源行没有匹配已召回的知识库文件")
    return not issues, issues


def append_citations(answer: str, chunks: list[ChunkRecord]) -> str:
    source_lines = []
    for chunk in chunks[:3]:
        section = " / ".join(chunk.payload.section_path) if chunk.payload.section_path else chunk.payload.title
        source_lines.append(f"来源：{chunk.payload.source_file} / {section}")
    return answer.rstrip() + "\n\n" + "\n".join(source_lines)


def build_review_reason(state: RagQueryState) -> str | None:
    reasons: list[str] = []
    if not state.get("context_sufficient", True):
        reasons.append(state.get("context_reason") or "检索上下文不足")
    if not state.get("quality_passed", True):
        reasons.extend(state.get("quality_issues", []) or ["答案质量检查未通过"])
    if not state.get("citations_valid", True):
        reasons.extend(state.get("citation_issues", []) or ["引用格式或来源校验未通过"])
    return "；".join(reasons) if reasons else None


def build_low_confidence(state: RagQueryState, chunks: list[ChunkRecord], answer: str) -> tuple[bool, str | None]:
    reasons: list[str] = []
    if not chunks:
        reasons.append("没有召回知识片段")
    if not state.get("context_sufficient", True):
        reasons.append(state.get("context_reason") or "检索上下文不足")
    if not state.get("quality_passed", True):
        reasons.extend(state.get("quality_issues", []) or ["答案质量检查未通过"])
    if state.get("review_required"):
        reasons.append(state.get("review_reason") or "需要人工审核")
    if "知识库暂未覆盖" in answer:
        reasons.append("答案声明知识库暂未覆盖")
    if state.get("provider_status") not in (None, "success", "skipped", "not_called"):
        reasons.append(f"模型调用异常：{state.get('provider_status')}")
    return bool(reasons), "；".join(reasons) if reasons else None


def classify_provider_error(exc: Exception) -> str:
    text = str(exc).lower()
    if "timeout" in text or "timed out" in text or "超时" in text:
        return "timeout"
    if "401" in text or "403" in text or "api key" in text or "apikey" in text or "unauthorized" in text:
        return "auth_error"
    if "429" in text or "rate limit" in text:
        return "rate_limited"
    if "502" in text or "503" in text or "504" in text or "connection" in text or "连接" in text:
        return "network_error"
    return "provider_error"


def extract_related_spots(chunks: list[ChunkRecord]) -> list[str]:
    spots: list[str] = []
    for chunk in chunks:
        if chunk.payload.spot_name and chunk.payload.spot_name not in spots:
            spots.append(chunk.payload.spot_name)
        if len(spots) >= 5:
            break
    return spots
