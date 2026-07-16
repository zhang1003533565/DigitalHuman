import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import axios from 'axios'
import ts from 'typescript'

const sourceUrl = new URL('./knowledgeOpenApi.ts', import.meta.url)
const source = readFileSync(sourceUrl, 'utf8')
const sourceDir = dirname(fileURLToPath(sourceUrl))

let compiledModuleUrl = null
let compiledModulePromise = null
let compiledModuleDir = null

async function loadKnowledgeOpenApiModule() {
  if (!compiledModulePromise) {
    compiledModuleDir = mkdtempSync(join(sourceDir, '.knowledge-openapi-test-'))
    const compiledModulePath = join(compiledModuleDir, 'knowledgeOpenApi.mjs')
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2023,
      },
      fileName: sourceUrl.pathname,
    })
    writeFileSync(compiledModulePath, compiled.outputText, 'utf8')
    compiledModuleUrl = pathToFileURL(compiledModulePath).href
    compiledModulePromise = import(compiledModuleUrl)
  }
  return compiledModulePromise
}

test.after(() => {
  if (compiledModuleDir) {
    rmSync(compiledModuleDir, { recursive: true, force: true })
  }
})

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

test('MaxKB upload model list uses the account proxy', () => {
  assert.match(source, /export type MaxKbUploadModelType = 'LLM' \| 'IMAGE'/)
  assert.match(source, /export type MaxKbUploadModel/)
  assert.match(source, /export async function getKnowledgeModels/)
  assert.match(source, /accounts\/\$\{accountId\}\/models/)
  assert.match(source, /model_type: modelType/)
})

test('getKnowledgeModels unwraps nested ApiResult and MaxKB response payloads', async (t) => {
  const { getKnowledgeModels } = await loadKnowledgeOpenApiModule()
  const models = [
    {
      id: 'model-image-1',
      name: 'Vision Pro',
      model_name: 'vision-pro',
      model_type: 'IMAGE',
      provider: 'maxkb',
      scope: 'workspace',
    },
  ]
  const wrappedPayload = {
    code: 0,
    msg: 'ok',
    data: {
      code: 200,
      data: models,
    },
  }
  const calls = []
  const originalGet = axios.get
  axios.get = async (...args) => {
    calls.push(args)
    return { data: wrappedPayload }
  }
  t.after(() => {
    axios.get = originalGet
  })

  const result = await getKnowledgeModels(42, 'IMAGE')

  assert.deepEqual(result, models)
  assert.equal(Array.isArray(result), true)
  assert.notDeepEqual(result, wrappedPayload)
  assert.notDeepEqual(result, wrappedPayload.data)
  assert.deepEqual(calls, [
    [
      '/api/admin/knowledge/maxkb/accounts/42/models',
      { params: { model_type: 'IMAGE' } },
    ],
  ])
})
