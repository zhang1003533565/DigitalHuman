from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile
import re

from agents.common.base import BaseAgent
from agents.common.types import AgentContext, AgentResult
from agents.common.utils import is_empty_row, normalize_text

REQUIRED_HEADERS = [
    "tourist_id",
    "user_nickname",
    "age",
    "gender",
    "attraction_name",
    "attraction_content",
    "attraction_type",
    "visit_date",
    "stay_duration",
    "ticket_cost",
    "food_cost",
    "shopping_cost",
    "transport_cost",
    "entertainment_cost",
    "total_cost",
    "group_size",
    "satisfaction",
]

NS = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL_NS = {"r": "http://schemas.openxmlformats.org/package/2006/relationships"}


class TravelAnalyticsAgent(BaseAgent):
    name = "travel_analytics_agent"
    skill_path = "agents/travel_analytics_agent/SKILL.md"

    def run(self, context: AgentContext) -> AgentResult:
        path = Path(context.file_path)
        if path.suffix.lower() != ".xlsx":
            return AgentResult(agent=self.name, success=False, output={}, warnings=["仅支持 .xlsx 文件"])

        rows = _read_first_sheet_rows(path)
        if not rows:
            return AgentResult(agent=self.name, success=False, output={}, warnings=["Excel 无数据"])

        headers = [normalize_text(v) for v in rows[0][: len(REQUIRED_HEADERS)]]
        if headers != REQUIRED_HEADERS:
            return AgentResult(
                agent=self.name,
                success=False,
                output={"headers": headers},
                warnings=["表头不匹配，必须为旅游行为分析17列"],
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
            data = {REQUIRED_HEADERS[i]: values[i] for i in range(len(REQUIRED_HEADERS))}
            tourist_id = data["tourist_id"]
            if not tourist_id:
                if len(warnings) < 200:
                    warnings.append(f"第{idx}行 tourist_id 为空，已跳过")
                else:
                    warning_overflow += 1
                continue
            if tourist_id.lower() in seen_ids:
                if len(warnings) < 200:
                    warnings.append(f"第{idx}行 tourist_id 重复，已跳过")
                else:
                    warning_overflow += 1
                continue
            seen_ids.add(tourist_id.lower())
            records.append(data)

        if warning_overflow:
            warnings.append(f"还有 {warning_overflow} 条告警已省略")

        return AgentResult(
            agent=self.name,
            success=True,
            output={
                "table": "travel_analytics_record",
                "records": records,
                "recordCount": len(records),
            },
            warnings=warnings,
        )


def _read_first_sheet_rows(path: Path) -> list[list[str]]:
    with ZipFile(path, "r") as zf:
        shared = _read_shared_strings(zf)
        sheet_xml = zf.read(_first_sheet_xml_path(zf))

    root = ET.fromstring(sheet_xml)
    sheet_data = root.find("a:sheetData", NS)
    if sheet_data is None:
        return []

    parsed_rows: list[list[str]] = []
    for row in sheet_data.findall("a:row", NS):
        values_map: dict[int, str] = {}
        max_col = -1
        for cell in row.findall("a:c", NS):
            ref = cell.attrib.get("r", "A1")
            col_idx = _col_index_from_ref(ref)
            max_col = max(max_col, col_idx)
            cell_type = cell.attrib.get("t", "")
            value = ""

            if cell_type == "inlineStr":
                t = cell.find("a:is/a:t", NS)
                value = t.text if t is not None and t.text else ""
            else:
                v = cell.find("a:v", NS)
                raw = v.text if v is not None and v.text is not None else ""
                if cell_type == "s":
                    try:
                        value = shared[int(raw)]
                    except Exception:
                        value = raw
                else:
                    value = raw
            values_map[col_idx] = normalize_text(value)

        if max_col < 0:
            parsed_rows.append([])
            continue

        ordered = [values_map.get(i, "") for i in range(max_col + 1)]
        parsed_rows.append(ordered)

    return parsed_rows


def _first_sheet_xml_path(zf: ZipFile) -> str:
    workbook_xml = ET.fromstring(zf.read("xl/workbook.xml"))
    first_sheet = workbook_xml.find("a:sheets/a:sheet", NS)
    if first_sheet is None:
        return "xl/worksheets/sheet1.xml"

    rel_id = first_sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
    if not rel_id:
        return "xl/worksheets/sheet1.xml"

    rels_xml = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
    for rel in rels_xml.findall("r:Relationship", REL_NS):
        if rel.attrib.get("Id") == rel_id:
            target = rel.attrib.get("Target", "worksheets/sheet1.xml")
            if target.startswith("/"):
                target = target[1:]
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            return target
    return "xl/worksheets/sheet1.xml"


def _read_shared_strings(zf: ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
    rows: list[str] = []
    for si in root.findall("a:si", NS):
        parts = [t.text or "" for t in si.findall(".//a:t", NS)]
        rows.append("".join(parts))
    return rows


def _col_index_from_ref(ref: str) -> int:
    letters = re.match(r"([A-Z]+)", ref)
    if not letters:
        return 0
    col = 0
    for ch in letters.group(1):
        col = col * 26 + (ord(ch) - ord("A") + 1)
    return col - 1
