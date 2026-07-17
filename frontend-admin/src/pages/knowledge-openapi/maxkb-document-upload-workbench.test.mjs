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
  assert.match(source, /mode="tags"/)
  assert.match(source, /previewDisabled/)
  assert.match(source, /className="mkb-upload-panel-section mkb-upload-task-panel"/)
  assert.match(source, /className="mkb-upload-panel-section mkb-upload-preview-panel"/)
  assert.doesNotMatch(source, /className="mkb-upload-task-panel"[\s\S]*?<Card/)
  assert.doesNotMatch(source, /className="mkb-upload-preview-panel"[\s\S]*?<Card/)
})

test('workbench validates ordinary document limits', () => {
  assert.match(source, /MAX_FILE_COUNT = 50/)
  assert.match(source, /MAX_FILE_SIZE = 100 \* 1024 \* 1024/)
  assert.match(source, /SUPPORTED_EXTENSIONS/)
  assert.match(source, /文件不能为空/)
})

test('helpers enforce the exact file, advanced-limit, and polling contracts', async () => {
  const { __TESTING__ } = await loadTestingHelpers()

  assert.deepEqual(
    [...__TESTING__.SUPPORTED_EXTENSIONS].sort(),
    ['csv', 'docx', 'html', 'log', 'md', 'pdf', 'txt', 'xls', 'xlsx', 'zip'],
  )
  assert.equal(__TESTING__.isAdvancedLimitValid(49), false)
  assert.equal(__TESTING__.isAdvancedLimitValid(50), true)
  assert.equal(__TESTING__.isAdvancedLimitValid(100000), true)
  assert.equal(__TESTING__.isAdvancedLimitValid(100001), false)

  for (const status of ['QUEUED', 'PROCESSING', 'PARSING', 'APPLYING']) {
    assert.equal(__TESTING__.shouldPollStatus(status), true, `${status} should keep polling`)
  }
  assert.equal(__TESTING__.shouldPollStatus('PREVIEW_READY'), false)
  assert.equal(__TESTING__.MAX_POLL_TRANSIENT_FAILURES, 12)
  assert.equal(__TESTING__.pollDelayMs(0), 1000)
  assert.equal(__TESTING__.pollDelayMs(2), 2000)
  assert.equal(__TESTING__.pollDelayMs(12), 5000)
  assert.equal(__TESTING__.shouldRetryPollError({ response: { status: 502 } }, 0), true)
  assert.equal(__TESTING__.shouldRetryPollError({ response: { status: 504 } }, 11), true)
  assert.equal(__TESTING__.shouldRetryPollError({ response: { status: 502 } }, 12), false)
  assert.equal(__TESTING__.shouldRetryPollError({ response: { status: 400 } }, 0), false)
})

test('helpers gate confirmation, deletion, and stale request writes', async () => {
  const { __TESTING__ } = await loadTestingHelpers()
  const confirmable = {
    status: 'PREVIEW_READY',
    taskId: 'task-1',
    previewTaskId: 'task-1',
    previewLoading: false,
    previewError: '',
    previewRecordCount: 2,
  }

  assert.equal(__TESTING__.canConfirmPreview(confirmable), true)
  assert.equal(__TESTING__.canConfirmPreview({ ...confirmable, status: 'PROCESSING' }), false)
  assert.equal(__TESTING__.canConfirmPreview({ ...confirmable, previewTaskId: '' }), false)
  assert.equal(__TESTING__.canConfirmPreview({ ...confirmable, previewTaskId: 'task-2' }), false)
  assert.equal(__TESTING__.canConfirmPreview({ ...confirmable, previewLoading: true }), false)
  assert.equal(__TESTING__.canConfirmPreview({ ...confirmable, previewError: 'preview failed' }), false)
  assert.equal(__TESTING__.canConfirmPreview({ ...confirmable, previewRecordCount: 0 }), false)

  assert.equal(__TESTING__.canDeleteTask('PARSING'), false)
  assert.equal(__TESTING__.canDeleteTask('PROCESSING'), false)
  assert.equal(__TESTING__.canDeleteTask('PREVIEW_READY'), true)
  assert.equal(__TESTING__.canDeleteTask('FAILED'), true)

  assert.equal(__TESTING__.isRequestScopeCurrent(7, 7), true)
  assert.equal(__TESTING__.isRequestScopeCurrent(7, 8), false)
  assert.equal(__TESTING__.isRequestGenerationCurrent(3, 3), true)
  assert.equal(__TESTING__.isRequestGenerationCurrent(3, 4), false)
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
      metrics: {
        processed: 12,
        total: 25,
        remaining: 13,
      },
    },
  })

  assert.equal(payload.taskId, 'task-1')
  assert.equal(payload.status, 'PROCESSING')
  assert.equal(payload.progressPercent, 48)
  assert.equal(payload.processedCount, 12)
  assert.equal(payload.totalCount, 25)
  assert.equal(payload.remainingCount, 13)
  assert.equal(__TESTING__.shouldPollStatus('PROCESSING'), true)
  assert.equal(__TESTING__.shouldPollStatus('PARSING'), true)
  assert.equal(__TESTING__.shouldPollStatus('PREVIEW_READY'), false)
})

test('helpers render nested preview content without object string leakage', async () => {
  const { __TESTING__ } = await loadTestingHelpers()

  const documents = __TESTING__.normalizePreviewDocuments([
    {
      document_id: 'doc-1',
      document_name: '索引.docx',
      id: 'p-1',
      title: '索引',
      content: [
        { content: '第一段内容' },
        { text: '第二段内容' },
        { title: '小节', children: [{ content: '第三段内容' }] },
      ],
    },
  ])

  assert.equal(documents.length, 1)
  assert.equal(documents[0].paragraphs[0].content, '第一段内容\n第二段内容\n小节\n第三段内容')
  assert.doesNotMatch(documents[0].paragraphs[0].content, /\[object Object\]/)
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
    patterns: ['##', '###'],
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
    patterns: ['##', '###', '##', '  '],
    withFilter: true,
    llmModelId: '',
    visionModelId: '',
    qualityOptimize: false,
  })
  assert.deepEqual(advancedPayload.patterns, ['##', '###'])
  assert.equal(advancedPayload.withFilter, true)
  assert.equal(advancedPayload.limit, 2048)
})

test('helpers disable preview exactly when the guarded submit path would reject', async () => {
  const { __TESTING__ } = await loadTestingHelpers()

  const baseArgs = {
    selectedFilesCount: 1,
    splitMode: 'smart',
    advancedLimit: 4096,
    llmModelId: 'llm-a',
    visionModelId: 'img-a',
    creatingPreview: false,
  }

  assert.equal(__TESTING__.isPreviewDisabled(baseArgs), false)
  assert.equal(__TESTING__.isPreviewDisabled({ ...baseArgs, selectedFilesCount: 0 }), true)
  assert.equal(__TESTING__.isPreviewDisabled({ ...baseArgs, splitMode: 'advanced', advancedLimit: 49 }), true)
  assert.equal(__TESTING__.isPreviewDisabled({ ...baseArgs, splitMode: 'llm_text', llmModelId: '' }), true)
  assert.equal(__TESTING__.isPreviewDisabled({ ...baseArgs, splitMode: 'llm_vision', llmModelId: '' }), true)
  assert.equal(__TESTING__.isPreviewDisabled({ ...baseArgs, splitMode: 'llm_vision', visionModelId: '' }), true)
  assert.equal(__TESTING__.isPreviewDisabled({ ...baseArgs, creatingPreview: true }), true)
})
