# Scenic Structured Agent Skill

## Goal
Parse the DOCX file `灵山胜境 景点结构化数据集.docx` and convert table rows into the scenic structured schema.

## Input
- DOCX table with exact Chinese headers:
  - 景区名称,景点ID,景点名称,具体位置,建筑/景观参数,核心功能,文化内涵,详细介绍,游玩亮点,演艺/开放信息,备注

## Output
- Normalized records compatible with backend table `scenic_spot_structured_record`.
- Diagnostics for empty rows, missing `景点ID`, duplicates.

## Constraints
- Keep Chinese semantics intact.
- Preserve long text fields fully.
