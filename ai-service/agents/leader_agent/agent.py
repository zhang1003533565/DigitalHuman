from __future__ import annotations

from pathlib import Path

from agents.common.base import BaseAgent
from agents.common.types import AgentContext, AgentResult
from agents.guide_script_agent.agent import GuideScriptAgent
from agents.scenic_structured_agent.agent import ScenicStructuredAgent
from agents.travel_analytics_agent.agent import TravelAnalyticsAgent


class LeaderAgent(BaseAgent):
    name = "leader_agent"
    skill_path = "agents/leader_agent/SKILL.md"

    def __init__(self) -> None:
        self.travel_agent = TravelAnalyticsAgent()
        self.scenic_agent = ScenicStructuredAgent()
        self.guide_agent = GuideScriptAgent()

    def run(self, context: AgentContext) -> AgentResult:
        path = Path(context.file_path)
        suffix = path.suffix.lower()
        name = path.name

        if suffix == ".xlsx":
            result = self.travel_agent.run(context)
            return self._wrap("travel_analytics_agent", result)

        if suffix == ".docx":
            if "结构化数据集" in name:
                result = self.scenic_agent.run(context)
                return self._wrap("scenic_structured_agent", result)
            result = self.guide_agent.run(context)
            if result.success and result.output.get("recordCount", 0) > 0:
                return self._wrap("guide_script_agent", result)
            fallback = self.scenic_agent.run(context)
            return self._wrap("scenic_structured_agent", fallback)

        return AgentResult(
            agent=self.name,
            success=False,
            output={},
            warnings=["不支持的文件类型，仅支持 .xlsx/.docx"],
        )

    def chat(self, message: str) -> dict[str, str]:
        message = (message or "").strip()
        if not message:
            return {"role": "leader", "answer": "你好，我是编排智能体。你可以上传 Excel 或 DOCX，我会自动转成结构化数据。"}
        return {
            "role": "leader",
            "answer": f"已收到：{message}。请上传文件，我会自动识别并分配给旅游行为、景点结构化或口播脚本智能体处理。",
        }

    def _wrap(self, selected: str, result: AgentResult) -> AgentResult:
        output = {
            "selectedAgent": selected,
            **result.output,
        }
        return AgentResult(agent=self.name, success=result.success, output=output, warnings=result.warnings)
