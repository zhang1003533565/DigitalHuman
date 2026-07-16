import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const componentUrl = new URL('./MaxKbDocumentUploadWorkbench.tsx', import.meta.url)
const source = readFileSync(componentUrl, 'utf8')

function extractHelperModule() {
  const start = source.indexOf('/* TESTING_HELPERS_START */')
  const end = source.indexOf('/* TESTING_HELPERS_END */')
  assert.notEqual(start, -1, 'helper block start marker missing')
  assert.notEqual(end, -1, 'helper block end marker missing')
  return source.slice(start, end)
}

async function loadTestingHelpers() {
  const helperSource = `${extractHelperModule()}\nexport { __TESTING__ }\n`
  const transpiled = ts.transpileModule(helperSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const encoded = Buffer.from(transpiled.outputText, 'utf8').toString('base64')
  return import(`data:text/javascript;base64,${encoded}`)
}

test('workbench follows MaxKB two-step upload flow', () => {
  assert.match(source, /Upload\.Dragger/)
  assert.match(source, /智能分段/)
  assert.match(source, /高级分段/)
  assert.match(source, /模型分段/)
  assert.match(source, /视觉模型分段/)
  assert.match(source, /getKnowledgeModels\(accountId, 'LLM'\)/)
  assert.match(source, /getKnowledgeModels\(accountId, 'IMAGE'\)/)
  assert.match(source, /uploadKnowledgeDocuments/)
  assert.match(source, /getKnowledgeUploadTask/)
  assert.match(source, /previewKnowledgeUploadTask/)
  assert.match(source, /applyKnowledgeUploadTask/)
  assert.match(source, /cancelKnowledgeUploadTask/)
  assert.match(source, /listKnowledgeUploadTasks/)
  assert.match(source, /Collapse/)
  assert.match(source, /确认导入/)
  assert.match(source, /autoApply:\s*false/)
})

test('workbench validates ordinary document limits', () => {
  assert.match(source, /MAX_FILE_COUNT = 50/)
  assert.match(source, /MAX_FILE_SIZE = 100 \* 1024 \* 1024/)
  assert.match(source, /SUPPORTED_EXTENSIONS/)
  assert.match(source, /文件不能为空/)
})

test('helpers validate files and normalize preview polling payloads', async () => {
  const { __TESTING__ } = await loadTestingHelpers()

  const valid = new File(['hello'], 'notes.md', { type: 'text/markdown' })
  const duplicate = new File(['world'], 'notes.md', { type: 'text/markdown' })
  const invalid = new File(['x'], 'virus.exe', { type: 'application/octet-stream' })
  const empty = new File([], 'empty.txt', { type: 'text/plain' })

  const result = __TESTING__.validateIncomingFiles({
    currentFiles: [valid],
    incomingFiles: [duplicate, invalid, empty, valid],
  })

  assert.equal(result.acceptedFiles.length, 1)
  assert.equal(result.acceptedFiles[0].name, 'notes.md')
  assert.deepEqual(result.errors, [
    'notes.md 已存在，无需重复选择',
    'virus.exe 文件类型不受支持',
    'empty.txt 文件不能为空',
    'notes.md 已存在，无需重复选择',
  ])

  const payload = __TESTING__.normalizeTaskPayload({
    code: 0,
    data: {
      task_id: 'task-1',
      status: 'PROCESSING',
      progress: 0.48,
      processed: 12,
      total: 25,
    },
  })

  assert.equal(payload.taskId, 'task-1')
  assert.equal(payload.status, 'PROCESSING')
  assert.equal(payload.progressPercent, 48)
  assert.equal(payload.processedCount, 12)
  assert.equal(payload.totalCount, 25)
  assert.equal(__TESTING__.shouldPollStatus('PROCESSING'), true)
  assert.equal(__TESTING__.shouldPollStatus('PREVIEW_READY'), false)
})

test('helpers create strategy-specific upload payloads and grouped model options', async () => {
  const { __TESTING__ } = await loadTestingHelpers()

  const grouped = __TESTING__.groupModelOptions([
    { id: 'llm-a', name: 'DeepSeek', model_name: 'v3', model_type: 'LLM', provider: 'DeepSeek' },
    { id: 'img-a', name: 'Qwen VL', model_name: 'max', model_type: 'IMAGE', provider: '阿里云' },
    { id: 'shared', name: 'Shared', model_type: 'LLM', scope: 'shared' },
  ])
  assert.deepEqual(grouped, [
    {
      label: '工作空间 / DeepSeek',
      options: [{ value: 'llm-a', label: 'DeepSeek · v3' }],
    },
    {
      label: '工作空间 / 阿里云',
      options: [{ value: 'img-a', label: 'Qwen VL · max' }],
    },
    {
      label: '共享 / 其他',
      options: [{ value: 'shared', label: 'Shared' }],
    },
  ])

  const payload = __TESTING__.buildUploadPayload({
    files: [new File(['doc'], 'chapter.pdf', { type: 'application/pdf' })],
    splitMode: 'llm_vision',
    limit: 2048,
    patternsText: '##\n###',
    withFilter: true,
    llmModelId: 'llm-a',
    visionModelId: 'img-a',
    qualityOptimize: true,
  })

  assert.equal(payload.autoApply, false)
  assert.equal(payload.splitStrategy, 'llm_vision')
  assert.equal(payload.llmModelId, 'llm-a')
  assert.equal(payload.visionModelId, 'img-a')
  assert.equal(payload.patterns, undefined)

  const advancedPayload = __TESTING__.buildUploadPayload({
    files: [new File(['doc'], 'chapter.pdf', { type: 'application/pdf' })],
    splitMode: 'advanced',
    limit: 2048,
    patternsText: '##\n###',
    withFilter: true,
    llmModelId: '',
    visionModelId: '',
    qualityOptimize: false,
  })
  assert.deepEqual(advancedPayload.patterns, ['##', '###'])
  assert.equal(advancedPayload.withFilter, true)
  assert.equal(advancedPayload.limit, 2048)
})
