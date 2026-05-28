from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from agents import LeaderAgent
from agents.catalog_service import load_agent_catalog
from agents.model_binding_service import (
    AgentModelBindingPayload,
    get_agent_bindings,
    update_agent_bindings,
)
from agents.runtime_test_service import test_agent_runtime
from agents.common.types import AgentContext
from rag.config.settings import get_settings
from rag.content.file_store import ensure_directory

router = APIRouter(prefix="/agents", tags=["agents"])
leader = LeaderAgent()


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


@router.post("/leader/chat")
def leader_chat(message: str = Form(default="")) -> dict[str, object]:
    return leader.chat(message)


@router.post("/transform")
async def transform(file: UploadFile = File(...), save_to_kb: bool = Form(default=False)) -> dict[str, object]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in {".xlsx", ".docx"}:
        raise HTTPException(status_code=400, detail="仅支持 .xlsx/.docx")

    settings = get_settings()
    kb_dir = ensure_directory(settings.knowledge_base_dir)
    target = kb_dir / file.filename
    content = await file.read()
    target.write_bytes(content)

    context = AgentContext(file_name=file.filename, file_path=str(target))
    result = leader.run(context)

    if not save_to_kb and target.exists():
        target.unlink(missing_ok=True)

    return {
        "success": result.success,
        "agent": result.agent,
        "warnings": result.warnings,
        "output": result.output,
    }


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
