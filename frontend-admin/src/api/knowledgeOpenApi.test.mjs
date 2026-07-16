import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('./knowledgeOpenApi.ts', import.meta.url), 'utf8')

test('MaxKB async document upload API wrappers match the open interface', () => {
  assert.match(source, /export type MaxKbUploadDocumentsPayload/)
  assert.match(source, /export async function uploadKnowledgeDocuments/)
  assert.match(source, /Idempotency-Key/)
  assert.match(source, /file_id/)
  assert.match(source, /vision_model_id/)
  assert.match(source, /llm_model_id/)
  assert.match(source, /quality_optimize/)
  assert.match(source, /auto_apply/)

  assert.match(source, /export async function listKnowledgeUploadTasks/)
  assert.match(source, /export async function getKnowledgeUploadTask/)
  assert.match(source, /export async function previewKnowledgeUploadTask/)
  assert.match(source, /export async function applyKnowledgeUploadTask/)
  assert.match(source, /export async function cancelKnowledgeUploadTask/)
  assert.match(source, /export async function deleteKnowledgeUploadTask/)
  assert.match(source, /documents\/upload-tasks/)
})
