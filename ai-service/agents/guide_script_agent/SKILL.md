# Guide Script Agent Skill

## Goal
Parse the guide DOCX `灵山胜境：历史、文化、景点特色与个性化游览指南.docx` and generate long-form voice scripts.

## Input
- Rich text paragraphs and sections from DOCX.

## Output
- Structured voice scripts for table `voice_script_scene` with scene types and styles.
- Draft records for overview and spot narration.

## Constraints
- Long-form script length should typically be 100-1200 chars.
- Add simple SSML pauses.
- Output default status as draft.
