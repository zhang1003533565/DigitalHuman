import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync(new URL('./KnowledgeOpenApiPage.tsx', import.meta.url), 'utf8')

test('knowledge page delegates upload to the MaxKB-style workbench', () => {
  assert.match(page, /MaxKbDocumentUploadWorkbench/)
  assert.match(page, /openUploadWorkbench/)
  assert.match(page, /view === 'upload'/)
  assert.doesNotMatch(page, /title=\{`上传文档到/)
  assert.doesNotMatch(page, /模型 ID 请填写 MaxKB 模型管理中的模型 ID/)
  assert.doesNotMatch(page, /<Input[\s\S]*placeholder="填写 MaxKB LLM 模型 ID"/)
})
