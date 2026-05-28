from __future__ import annotations

from pathlib import Path

from docx import Document

from agents.common.base import BaseAgent
from agents.common.types import AgentContext, AgentResult
from agents.common.utils import is_empty_row, normalize_text

REQUIRED_HEADERS = [
    "景区名称",
    "景点ID",
    "景点名称",
    "具体位置",
    "建筑/景观参数",
    "核心功能",
    "文化内涵",
    "详细介绍",
    "游玩亮点",
    "演艺/开放信息",
    "备注",
]

FIELD_MAP = {
    "景区名称": "scenic_name",
    "景点ID": "spot_id",
    "景点名称": "spot_name",
    "具体位置": "location",
    "建筑/景观参数": "architecture_landscape_params",
    "核心功能": "core_function",
    "文化内涵": "cultural_connotation",
    "详细介绍": "detailed_introduction",
    "游玩亮点": "highlights",
    "演艺/开放信息": "performance_open_info",
    "备注": "remark",
}


class ScenicStructuredAgent(BaseAgent):
    name = "scenic_structured_agent"
    skill_path = "agents/scenic_structured_agent/SKILL.md"

    def run(self, context: AgentContext) -> AgentResult:
        path = Path(context.file_path)
        if path.suffix.lower() != ".docx":
            return AgentResult(agent=self.name, success=False, output={}, warnings=["仅支持 .docx 文件"])

        rows = _extract_table_rows(path)
        if not rows:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["未找到结构化数据表"])

        headers = [normalize_text(v) for v in rows[0][: len(REQUIRED_HEADERS)]]
        if headers != REQUIRED_HEADERS:
            return AgentResult(
                agent=self.name,
                success=False,
                output={"headers": headers},
                warnings=["表头不匹配，必须为景点结构化11列中文字段"],
            )

        records: list[dict[str, str]] = []
        warnings: list[str] = []
        warning_overflow = 0
        seen_ids: set[str] = set()

        for idx, row in enumerate(rows[1:], start=2):
            values = [normalize_text(v) for v in row[: len(REQUIRED_HEADERS)]]
            while len(values) < len(REQUIRED_HEADERS):
                values.append("")
            if is_empty_row(values):
                continue

            zh_data = {REQUIRED_HEADERS[i]: values[i] for i in range(len(REQUIRED_HEADERS))}
            spot_id = zh_data["景点ID"]
            if not spot_id:
                if len(warnings) < 200:
                    warnings.append(f"第{idx}行 景点ID 为空，已跳过")
                else:
                    warning_overflow += 1
                continue
            if spot_id.lower() in seen_ids:
                if len(warnings) < 200:
                    warnings.append(f"第{idx}行 景点ID 重复，已跳过")
                else:
                    warning_overflow += 1
                continue
            seen_ids.add(spot_id.lower())

            record = {FIELD_MAP[k]: zh_data.get(k, "") for k in REQUIRED_HEADERS}
            records.append(record)

        if warning_overflow:
            warnings.append(f"还有 {warning_overflow} 条告警已省略")

        return AgentResult(
            agent=self.name,
            success=True,
            output={
                "table": "scenic_spot_structured_record",
                "records": records,
                "recordCount": len(records),
            },
            warnings=warnings,
        )


def _extract_table_rows(path: Path) -> list[list[str]]:
    document = Document(path)
    for table in document.tables:
        rows = []
        for row in table.rows:
            rows.append([normalize_text(cell.text) for cell in row.cells])
        if not rows:
            continue
        if [normalize_text(v) for v in rows[0][: len(REQUIRED_HEADERS)]] == REQUIRED_HEADERS:
            return rows
    return []
