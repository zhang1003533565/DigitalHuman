# Multi-Agent Runtime Guide

## Architecture
Each agent has three layers:
- `SOUL.md`: identity, values, boundaries, behavior policy
- `SKILL.md`: task-specific parsing/transform instructions
- `agent.py`: executable logic

## Agents
- `leader_agent`: quick chat now, orchestration entrypoint later
- `basic_chat_agent`: direct quick chat fallback
- `travel_analytics_agent`: Excel -> `travel_analytics_record`
- `scenic_structured_agent`: structured DOCX table -> `scenic_spot_structured_record`
- `guide_script_agent`: narrative DOCX -> `voice_script_scene`

## API
- `POST /agents/leader/chat`
- `POST /agents/leader/chat/stream`
- `POST /agents/basic-chat`
- `POST /agents/basic-chat/stream`
- `GET /agents/health`

## Leader Status
`leader_agent` is the main agent entrypoint. It currently handles quick chat only and returns `dispatchEnabled=false`.
Specialist-agent dispatch will be attached later.

## Output Contract
- `success`: bool
- `agent`: executor name
- `warnings`: list[str]
- `output.answer`: assistant reply for chat endpoints
- `output.dispatchEnabled`: false while dispatch is not enabled
