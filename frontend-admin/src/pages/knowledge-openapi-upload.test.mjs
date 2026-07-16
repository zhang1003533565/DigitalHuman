import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./KnowledgeOpenApiPage.tsx', import.meta.url), 'utf8')

test('knowledge page supports MaxKB async document upload workflow', () => {
  assert.match(page, /uploadKnowledgeDocuments/)
  assert.match(page, /listKnowledgeUploadTasks/)
  assert.match(page, /previewKnowledgeUploadTask/)
  assert.match(page, /applyKnowledgeUploadTask/)
  assert.match(page, /cancelKnowledgeUploadTask/)
  assert.match(page, /deleteKnowledgeUploadTask/)
  assert.match(page, /openUploadDrawer/)
  assert.doesNotMatch(page, /<Button size="small" type="primary" icon=\{<CloudUploadOutlined \/>\} onClick=\{notifyReadOnlyAction\}>上传文档<\/Button>/)
  assert.match(page, /split_strategy/)
  assert.match(page, /model_id/)
  assert.match(page, /vision_model_id/)
  assert.match(page, /llm_model_id/)
  assert.match(page, /quality_optimize/)
  assert.match(page, /auto_apply/)
  assert.match(page, /确认入库/)
})
