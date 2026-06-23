from __future__ import annotations

from pathlib import Path
from zipfile import ZipFile
import re

from agents.common.base import BaseAgent
from agents.common.types import AgentContext, AgentResult
from agents.common.utils import normalize_text, sanitize_id


class GuideScriptAgent(BaseAgent):
    name = "guide_script_agent"
    skill_path = "agents/guide_script_agent/SKILL.md"

    def run(self, context: AgentContext) -> AgentResult:
        path = Path(context.file_path)
        if path.suffix.lower() != ".docx":
            return AgentResult(agent=self.name, success=False, output={}, warnings=["仅支持 .docx 文件"])

        paras = _extract_paragraphs(path)
        if not paras:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["DOCX 无可解析正文"])

        scenic_name = "灵山胜境"
        records: list[dict[str, object]] = []
        warnings: list[str] = []
        warning_overflow = 0

        overview_text = "\n".join(paras[: min(6, len(paras))]).strip()
        if len(overview_text) >= 100:
            records.append(_build_record(
                scenic_name=scenic_name,
                spot_id="overview",
                spot_name=f"{scenic_name}总览",
                scene_type="overview",
                style="culture",
                title=f"{scenic_name}总览讲解",
                script_text=_limit(overview_text, 1200),
                source_file=context.file_name,
                version_no=1,
            ))
        else:
            if len(warnings) < 200:
                warnings.append("总览段落不足100字，未生成 overview")
            else:
                warning_overflow += 1

        i = 0
        while i < len(paras):
            title = paras[i]
            if not _is_spot_title(title):
                i += 1
                continue

            body: list[str] = []
            j = i + 1
            while j < len(paras) and not _is_heading_like(paras[j]):
                if len(paras[j]) >= 12:
                    body.append(paras[j])
                j += 1

            script_text = normalize_text("\n".join(body))
            if len(script_text) >= 100:
                records.append(_build_record(
                    scenic_name=scenic_name,
                    spot_id=sanitize_id(title),
                    spot_name=title,
                    scene_type="spot",
                    style="culture",
                    title=f"{title}讲解",
                    script_text=_limit(script_text, 1200),
                    source_file=context.file_name,
                    version_no=1,
                ))
            else:
                if len(warnings) < 200:
                    warnings.append(f"景点《{title}》正文不足100字，已跳过")
                else:
                    warning_overflow += 1

            i = j

        if warning_overflow:
            warnings.append(f"还有 {warning_overflow} 条告警已省略")

        return AgentResult(
            agent=self.name,
            success=True,
            output={
                "table": "voice_script_scene",
                "records": records,
                "recordCount": len(records),
            },
            warnings=warnings,
        )


def _extract_paragraphs(path: Path) -> list[str]:
    with ZipFile(path, "r") as zf:
        xml = zf.read("word/document.xml").decode("utf-8", errors="ignore")
    paras = []
    for block in re.split(r"</w:p>", xml):
        texts = re.findall(r"<w:t[^>]*>(.*?)</w:t>", block)
        joined = normalize_text("".join(texts))
        if joined and not joined.startswith("<w:"):
            paras.append(joined)
    return paras


def _is_heading_like(text: str) -> bool:
    return any(k in text for k in ["景区概况", "核心文化", "核心景点", "游览", "总结", "其他特色"])


def _is_spot_title(text: str) -> bool:
    if len(text) < 3 or len(text) > 40:
        return False
    if "：" in text or ":" in text:
        return True
    return text.endswith(("寺", "宫", "塔", "佛", "广场", "坛城"))


def _limit(text: str, max_len: int) -> str:
    return text if len(text) <= max_len else text[:max_len]


def _ssml(text: str) -> str:
    s = text.replace("。", "。<break time=\"500ms\"/>").replace("！", "！<break time=\"450ms\"/>").replace("？", "？<break time=\"450ms\"/>")
    return f"<speak version=\"1.0\" xml:lang=\"zh-CN\">{s}</speak>"


def _estimate_duration(text: str) -> int:
    sec = int((len(text) / 4.2) + 0.999)
    return max(30, min(900, sec))


def _build_record(
    scenic_name: str,
    spot_id: str,
    spot_name: str,
    scene_type: str,
    style: str,
    title: str,
    script_text: str,
    source_file: str,
    version_no: int,
) -> dict[str, object]:
    return {
        "scenicName": scenic_name,
        "spotId": spot_id,
        "spotName": spot_name,
        "sceneType": scene_type,
        "style": style,
        "title": title,
        "scriptText": script_text,
        "ssmlText": _ssml(script_text),
        "durationSec": _estimate_duration(script_text),
        "versionNo": version_no,
        "status": "draft",
        "sourceFile": source_file,
    }
