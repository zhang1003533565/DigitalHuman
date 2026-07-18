import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('VoiceScriptPage.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../api/voiceScripts.ts', import.meta.url), 'utf8')

// AI generation API and source snapshot contract.
assert.match(api, /export type VoiceScriptGeneratePayload/)
assert.match(api, /generationMode\?:/)
assert.match(api, /sourceRefsJson\?: string/)
assert.match(api, /accountId: number/)
assert.match(api, /export type VoiceScriptKnowledgeSource/)
assert.match(api, /knowledgeSources: VoiceScriptKnowledgeSource\[\]/)
assert.match(api, /knowledgeId: string/)
assert.match(api, /knowledgeName: string/)
assert.match(api, /documentIds: string\[\]/)
assert.match(api, /targetDurationSec: number/)
assert.match(api, /additionalRequirements\?: string/)
assert.doesNotMatch(api, /  knowledgeIds: string\[\]/)
assert.doesNotMatch(api, /sceneType: VoiceScriptScene/)
assert.match(api, /\/api\/admin\/voice-scripts\/generate/)

// Audio lifecycle API contract.
assert.match(api, /export type VoiceScriptSynthesizePayload/)
assert.match(api, /voiceId: string/)
assert.match(api, /speechRate: string/)
assert.match(api, /speechVolume: string/)
assert.match(api, /speechPitch: string/)
assert.match(api, /'missing' \| 'ready' \| 'stale' \| 'failed'/)
assert.doesNotMatch(api, /sourceType|sourceSnapshot|rate: number|volume: number|pitch: number/)
assert.match(api, /\/records\/\$\{id\}\/synthesize/)
assert.match(api, /\/records\/\$\{id\}\/rollback/)

// Scenic spot and MaxKB sources are loaded through existing admin APIs.
assert.match(page, /getScenicStructuredRecords/)
assert.match(page, /getKnowledgeAccounts/)
assert.match(page, /getKnowledges/)
assert.match(page, /getKnowledgeDocuments/)
assert.match(page, /extractRecords/)
assert.match(page, /mode="multiple"/)
assert.match(page, /loadDocumentsForKnowledge/)
assert.match(page, /documentIdsByKnowledge/)
assert.match(page, /knowledgeSources: values\.knowledgeIds\.map/)
assert.match(page, /documentIds: values\.documentIdsByKnowledge\?\.\[knowledgeId\] \?\? \[\]/)

// Single-spot generation drawer and duration presets.
assert.match(page, /AI生成口播/)
assert.match(page, /选择景点/)
assert.match(page, /选择知识库账号/)
assert.match(page, /选择知识库/)
assert.match(page, /选择文档（可选）/)
assert.match(page, /补充要求/)
for (const duration of [30, 60, 90, 120]) {
  assert.match(page, new RegExp(`value: ${duration}, label: '${duration}秒'`))
}
assert.match(page, /value: 'custom', label: '自定义'/)
assert.match(page, /自定义时长（秒）/)
assert.match(page, /generateVoiceScript/)

// Manual scripts remain a first-class creation path.
assert.match(page, /手工新增/)
assert.match(page, /generationMode: 'manual'/)
assert.match(page, /sourceRefsJson/)
assert.match(page, /snapshot\.knowledgeSources/)
assert.match(page, /selectedDocumentIds/)

// Table exposes provenance and audio readiness.
assert.match(page, /title: '来源'/)
assert.match(page, /title: '音频状态'/)
assert.match(page, /音频可用/)
assert.match(page, /音频已过期/)
assert.match(page, /未合成/)

// Editing supports TTS parameters, preview, rollback, and publish gating.
assert.match(page, /音色/)
assert.match(page, /语速/)
assert.match(page, /音量/)
assert.match(page, /语调/)
assert.match(page, /name="speechRate"/)
assert.match(page, /name="speechVolume"/)
assert.match(page, /name="speechPitch"/)
assert.match(page, /value: '\+0%'/)
assert.match(page, /value: '\+0Hz'/)
assert.match(page, /合成试听/)
assert.match(page, /rollbackVoiceScriptRecord/)
assert.match(page, /回滚为新草稿/)
assert.match(page, /canPublishVoiceScript/)
assert.match(page, /发布前必须先合成与当前文本一致的音频/)
assert.match(page, /<audio controls/)

// Existing error feedback remains visible.
assert.match(page, /function voiceScriptErrorMessage/)
assert.match(page, /无法连接后端服务，请确认 backend-java 已启动/)
assert.match(page, /生成失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /合成失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /回滚失败：\$\{voiceScriptErrorMessage/)
assert.match(page, /发布失败：\$\{voiceScriptErrorMessage/)

console.log('knowledge-driven voice script workbench contract passed')
