from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from agents import LeaderAgent
from agents.common.types import AgentContext
from rag.config.settings import get_settings
from rag.content.file_store import ensure_directory

router = APIRouter(prefix="/agents", tags=["agents"])
leader = LeaderAgent()


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "agents": [
            {
                "name": "leader_agent",
                "soul": "agents/leader_agent/SOUL.md",
                "skill": "agents/leader_agent/SKILL.md",
            },
            {
                "name": "travel_analytics_agent",
                "soul": "agents/travel_analytics_agent/SOUL.md",
                "skill": "agents/travel_analytics_agent/SKILL.md",
            },
            {
                "name": "scenic_structured_agent",
                "soul": "agents/scenic_structured_agent/SOUL.md",
                "skill": "agents/scenic_structured_agent/SKILL.md",
            },
            {
                "name": "guide_script_agent",
                "soul": "agents/guide_script_agent/SOUL.md",
                "skill": "agents/guide_script_agent/SKILL.md",
            },
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
