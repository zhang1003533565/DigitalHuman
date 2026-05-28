# Multi-Agent Runtime Guide

## Architecture
Each agent has three layers:
- `SOUL.md`: identity, values, boundaries, behavior policy
- `SKILL.md`: task-specific parsing/transform instructions
- `agent.py`: executable logic

## Agents
- `leader_agent`: chat + orchestration
- `travel_analytics_agent`: Excel -> `travel_analytics_record`
- `scenic_structured_agent`: structured DOCX table -> `scenic_spot_structured_record`
- `guide_script_agent`: narrative DOCX -> `voice_script_scene`

## API
- `POST /agents/transform` (multipart file upload)
- `POST /agents/leader/chat`
- `GET /agents/health`

## Routing Rules (leader)
1. `.xlsx` => `travel_analytics_agent`
2. `.docx` filename contains `结构化数据集` => `scenic_structured_agent`
3. other `.docx` => `guide_script_agent` (fallback to scenic parser if needed)

## Output Contract
- `success`: bool
- `agent`: executor name
- `warnings`: list[str]
- `output.table`: target backend table name
- `output.records`: normalized row objects
