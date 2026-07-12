from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents import BasicChatAgent, LeaderAgent
from agents.catalog_service import load_agent_catalog
from agents.model_binding_service import (
    AgentModelBindingPayload,
    get_agent_bindings,
    update_agent_bindings,
)
from agents.runtime_test_service import test_agent_runtime
from agents.common.types import AgentContext, AgentResult
from schemas import AgentOutputResponse

router = APIRouter(prefix="/agents", tags=["agents"])
leader = LeaderAgent()
basic_chat_agent = BasicChatAgent()


class BasicChatRequest(BaseModel):
    message: str = Field(default="")
    history: list[dict[str, str]] = Field(default_factory=list)
    system_prompt: str = Field(default="", alias="systemPrompt")
    provider: str = Field(default="")
    model: str = Field(default="")
    base_url: str = Field(default="", alias="baseUrl")
    api_key: str = Field(default="", alias="apiKey")
    timeout_seconds: float = Field(default=90, alias="timeoutSeconds", gt=0, le=600)


class BasicChatResponse(BaseModel):
    success: bool
    agent: str
    warnings: list[str] = Field(default_factory=list)
    output: AgentOutputResponse


@router.get("/health")
def health() -> dict[str, object]:
    bindings = get_agent_bindings()
    by_agent = {item.agent: item for item in bindings.items}
    catalog = load_agent_catalog()
    return {
        "status": "ok",
        "agents": [
            {
                "name": item.name,
                "displayName": item.display_name,
                "soul": item.soul,
                "skill": item.skill,
                "categoryHint": item.category_hint,
                "modelBinding": by_agent.get(item.name),
            }
            for item in catalog
        ],
    }


@router.post("/leader/chat", response_model=BasicChatResponse)
def leader_chat(request: BasicChatRequest) -> BasicChatResponse:
    context = AgentContext(
        file_name="",
        file_path="",
        metadata={
            "message": request.message,
            "history": request.history,
            "systemPrompt": request.system_prompt,
            "provider": request.provider,
            "model": request.model,
            "baseUrl": request.base_url,
            "apiKey": request.api_key,
            "timeoutSeconds": request.timeout_seconds,
        },
    )
    result = leader.run(context)
    return BasicChatResponse(
        success=result.success,
        agent=result.agent,
        warnings=result.warnings,
        output=result.output,
    )


@router.post("/leader/chat/stream")
def leader_chat_stream(request: BasicChatRequest):
    context = AgentContext(
        file_name="",
        file_path="",
        metadata={
            "message": request.message,
            "history": request.history,
            "systemPrompt": request.system_prompt,
            "provider": request.provider,
            "model": request.model,
            "baseUrl": request.base_url,
            "apiKey": request.api_key,
            "timeoutSeconds": request.timeout_seconds,
        },
    )
    token_gen = leader.run_stream(context)

    if isinstance(token_gen, AgentResult):
        error_payload = json.dumps(
            {"success": token_gen.success, "agent": token_gen.agent, "warnings": token_gen.warnings},
            ensure_ascii=False,
        )
        def _error_sse():
            yield f"data: {error_payload}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_error_sse(), media_type="text/event-stream")

    def _sse_generator():
        try:
            for token in token_gen:
                chunk = json.dumps({"token": token}, ensure_ascii=False)
                yield f"data: {chunk}\n\n"
        except Exception as exc:
            error_payload = json.dumps({"error": str(exc)}, ensure_ascii=False)
            yield f"data: {error_payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_sse_generator(), media_type="text/event-stream")


@router.post("/basic-chat", response_model=BasicChatResponse)
def basic_chat(request: BasicChatRequest) -> BasicChatResponse:
    context = AgentContext(
        file_name="",
        file_path="",
        metadata={
            "message": request.message,
            "history": request.history,
            "systemPrompt": request.system_prompt,
            "provider": request.provider,
            "model": request.model,
            "baseUrl": request.base_url,
            "apiKey": request.api_key,
            "timeoutSeconds": request.timeout_seconds,
        },
    )
    result = basic_chat_agent.run(context)
    return BasicChatResponse(
        success=result.success,
        agent=result.agent,
        warnings=result.warnings,
        output=result.output,
    )


@router.post("/basic-chat/stream")
def basic_chat_stream(request: BasicChatRequest):
    context = AgentContext(
        file_name="",
        file_path="",
        metadata={
            "message": request.message,
            "history": request.history,
            "systemPrompt": request.system_prompt,
            "provider": request.provider,
            "model": request.model,
            "baseUrl": request.base_url,
            "apiKey": request.api_key,
            "timeoutSeconds": request.timeout_seconds,
        },
    )
    token_gen = basic_chat_agent.run_stream(context)

    # 如果前置校验失败，run_stream 返回的是 AgentResult
    if isinstance(token_gen, AgentResult):
        error_payload = json.dumps(
            {"success": token_gen.success, "agent": token_gen.agent, "warnings": token_gen.warnings},
            ensure_ascii=False,
        )
        def _error_sse():
            yield f"data: {error_payload}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(_error_sse(), media_type="text/event-stream")

    def _sse_generator():
        try:
            for token in token_gen:
                chunk = json.dumps({"token": token}, ensure_ascii=False)
                yield f"data: {chunk}\n\n"
        except Exception as exc:
            error_payload = json.dumps({"error": str(exc)}, ensure_ascii=False)
            yield f"data: {error_payload}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_sse_generator(), media_type="text/event-stream")


@router.get("/model-bindings", response_model=AgentModelBindingPayload)
def list_model_bindings() -> AgentModelBindingPayload:
    return get_agent_bindings()


@router.put("/model-bindings", response_model=AgentModelBindingPayload)
def save_model_bindings(payload: AgentModelBindingPayload) -> AgentModelBindingPayload:
    try:
        return update_agent_bindings(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/runtime-test")
def runtime_test(agent: str = Form(...), task: str = Form(...)) -> dict[str, object]:
    try:
        return test_agent_runtime(agent, task)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
