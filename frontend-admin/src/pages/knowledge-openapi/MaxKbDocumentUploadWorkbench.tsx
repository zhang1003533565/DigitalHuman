import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  Empty,
  Input,
  InputNumber,
  List,
  Progress,
  Result,
  Select,
  Slider,
  Space,
  Spin,
  Steps,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { UploadProps } from 'antd'
import {
  CheckCircleFilled,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  LoadingOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  applyKnowledgeUploadTask,
  cancelKnowledgeUploadTask,
  deleteKnowledgeUploadTask,
  extractRecords,
  getKnowledgeModels,
  getKnowledgeUploadTask,
  listKnowledgeUploadTasks,
  previewKnowledgeUploadTask,
  uploadKnowledgeDocuments,
  type MaxKbRecord,
  type MaxKbUploadDocumentsPayload,
  type MaxKbUploadModel,
} from '../../api/knowledgeOpenApi'

const { Paragraph, Text, Title } = Typography

type UploadStep = 'files' | 'rules' | 'success'
type SplitMode = 'smart' | 'advanced' | 'llm_text' | 'llm_vision'
type Props = {
  accountId: number
  knowledgeId: string
  knowledgeName: string
  onCancel: () => void
  onImported: () => void
}
type NormalizedTask = {
  taskId: string
  status: string
  progressPercent: number
  processedCount: number
  totalCount: number
  remainingCount: number
  stageText: string
  messageText: string
  createdAtText: string
  raw: MaxKbRecord
}
type PreviewParagraph = {
  key: string
  title: string
  content: string
}
type PreviewDocument = {
  key: string
  name: string
  paragraphs: PreviewParagraph[]
}

/* TESTING_HELPERS_START */
const MAX_FILE_COUNT = 50
const MAX_FILE_SIZE = 100 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set([
  'txt',
  'md',
  'log',
  'docx',
  'pdf',
  'html',
  'zip',
  'xlsx',
  'xls',
  'csv',
])

type TestingSplitMode = 'smart' | 'advanced' | 'llm_text' | 'llm_vision'
type TestingModel = {
  id: string
  name: string
  model_name?: string
  model_type: 'LLM' | 'IMAGE'
  provider?: string
  scope?: 'workspace' | 'shared'
}
type TestingModelGroup = {
  label: string
  options: Array<{ value: string; label: string }>
}
type TestingNormalizedTask = {
  taskId: string
  status: string
  progressPercent: number
  processedCount: number
  totalCount: number
  remainingCount: number
  stageText: string
  messageText: string
}
type ValidateIncomingFilesArgs = {
  currentFiles: File[]
  incomingFiles: File[]
}
type BuildUploadPayloadArgs = {
  files: File[]
  splitMode: TestingSplitMode
  limit: number
  patternsText: string
  withFilter: boolean
  llmModelId: string
  visionModelId: string
  qualityOptimize: boolean
}
type CanConfirmPreviewArgs = {
  status: string
  taskId: string
  previewTaskId: string
  previewLoading: boolean
  previewError: string
  previewRecordCount: number
}

function helperTextOf(record: Record<string, unknown>, keys: string[], fallback = '') {
  for (const key of keys) {
    const value = record[key]
    if (value == null) {
      continue
    }
    const text = String(value).trim()
    if (text) {
      return text
    }
  }
  return fallback
}

function helperNumberOf(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return fallback
}

function normalizeObjectPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }

  const record = payload as Record<string, unknown>
  const hasTaskFields = ['task_id', 'id', 'status', 'state', 'progress'].some((key) => key in record)
  if (hasTaskFields) {
    return record
  }

  for (const key of ['data', 'task', 'result', 'item']) {
    const nested = record[key]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const normalized = normalizeObjectPayload(nested)
      if (Object.keys(normalized).length > 0) {
        return normalized
      }
    }
  }
  return record
}

function progressPercentOf(rawValue: number) {
  if (!Number.isFinite(rawValue)) {
    return 0
  }
  if (rawValue > 0 && rawValue <= 1) {
    return Math.round(rawValue * 100)
  }
  return Math.max(0, Math.min(100, Math.round(rawValue)))
}

function shouldPollStatus(status: string) {
  return ['QUEUED', 'PROCESSING', 'PARSING', 'APPLYING'].includes(status.toUpperCase())
}

function isTerminalStatus(status: string) {
  return ['PREVIEW_READY', 'COMPLETED', 'FAILED', 'CANCELLED'].includes(status.toUpperCase())
}

function isAdvancedLimitValid(limit: number) {
  return Number.isInteger(limit) && limit >= 50 && limit <= 100000
}

function canConfirmPreview({
  status,
  taskId,
  previewTaskId,
  previewLoading,
  previewError,
  previewRecordCount,
}: CanConfirmPreviewArgs) {
  return status.toUpperCase() === 'PREVIEW_READY'
    && Boolean(taskId)
    && taskId === previewTaskId
    && !previewLoading
    && !previewError
    && previewRecordCount > 0
}

function canDeleteTask(status: string) {
  return isTerminalStatus(status)
}

function isRequestScopeCurrent(capturedScope: number, currentScope: number) {
  return capturedScope === currentScope
}

function isRequestGenerationCurrent(capturedGeneration: number, currentGeneration: number) {
  return capturedGeneration === currentGeneration
}

function normalizeTaskPayload(payload: unknown): TestingNormalizedTask {
  const record = normalizeObjectPayload(payload)
  const status = helperTextOf(record, ['status', 'state'], 'UNKNOWN').toUpperCase()
  const processedCount = helperNumberOf(record, ['processed', 'processed_count', 'success_count', 'finished'], 0)
  const totalCount = helperNumberOf(record, ['total', 'total_count', 'count', 'document_count'], 0)
  const remainingFallback = totalCount > processedCount ? totalCount - processedCount : 0

  return {
    taskId: helperTextOf(record, ['task_id', 'id'], ''),
    status,
    progressPercent: progressPercentOf(helperNumberOf(record, ['progress', 'progress_percent'], 0)),
    processedCount,
    totalCount,
    remainingCount: helperNumberOf(record, ['remaining', 'remaining_count'], remainingFallback),
    stageText: helperTextOf(record, ['stage', 'current_stage', 'step', 'current_step'], status),
    messageText: helperTextOf(record, ['message', 'error_message', 'fail_reason'], ''),
  }
}

function validateIncomingFiles({ currentFiles, incomingFiles }: ValidateIncomingFilesArgs) {
  const acceptedFiles = [...currentFiles]
  const seenNames = new Set(currentFiles.map((file) => file.name.trim().toLowerCase()))
  const errors: string[] = []

  incomingFiles.forEach((file) => {
    const normalizedName = file.name.trim().toLowerCase()
    const extension = file.name.includes('.') ? file.name.split('.').pop()?.trim().toLowerCase() ?? '' : ''

    if (!file.size) {
      errors.push(`${file.name} 文件不能为空`)
      return
    }
    if (!SUPPORTED_EXTENSIONS.has(extension)) {
      errors.push(`${file.name} 文件类型不受支持`)
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} 超过 100MB 大小限制`)
      return
    }
    if (seenNames.has(normalizedName)) {
      errors.push(`${file.name} 已存在，无需重复选择`)
      return
    }
    if (acceptedFiles.length >= MAX_FILE_COUNT) {
      errors.push(`${file.name} 超出最多可选 ${MAX_FILE_COUNT} 个文件`)
      return
    }

    seenNames.add(normalizedName)
    acceptedFiles.push(file)
  })

  return { acceptedFiles, errors }
}

function buildUploadPayload({
  files,
  splitMode,
  limit,
  patternsText,
  withFilter,
  llmModelId,
  visionModelId,
  qualityOptimize,
}: BuildUploadPayloadArgs): MaxKbUploadDocumentsPayload {
  const patterns = patternsText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    files,
    autoApply: false,
    ...(splitMode === 'advanced' ? { limit, patterns, withFilter } : {}),
    ...(splitMode === 'llm_text' ? {
      splitStrategy: 'llm_text',
      modelId: llmModelId,
      qualityOptimize,
    } : {}),
    ...(splitMode === 'llm_vision' ? {
      splitStrategy: 'llm_vision',
      visionModelId,
      llmModelId,
      qualityOptimize,
    } : {}),
  }
}

function groupModelOptions(models: TestingModel[]): TestingModelGroup[] {
  const groups = models.reduce<Record<string, TestingModel[]>>((result, model) => {
    const scopeLabel = model.scope === 'shared' ? '共享' : '工作空间'
    const provider = model.provider || '其他'
    const label = `${scopeLabel} / ${provider}`
    result[label] = [...(result[label] || []), model]
    return result
  }, {})

  return Object.entries(groups).map(([label, options]) => ({
    label,
    options: options.map((model) => ({
      value: model.id,
      label: `${model.name}${model.model_name ? ` · ${model.model_name}` : ''}`,
    })),
  }))
}

const __TESTING__ = {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
  SUPPORTED_EXTENSIONS,
  validateIncomingFiles,
  normalizeTaskPayload,
  shouldPollStatus,
  isTerminalStatus,
  isAdvancedLimitValid,
  canConfirmPreview,
  canDeleteTask,
  isRequestScopeCurrent,
  isRequestGenerationCurrent,
  buildUploadPayload,
  groupModelOptions,
}
void __TESTING__
/* TESTING_HELPERS_END */

const STEP_ITEMS = [
  { title: '选择文件' },
  { title: '预览规则' },
  { title: '完成导入' },
]

const STRATEGY_CARDS: Array<{ value: SplitMode; title: string; description: string }> = [
  { value: 'smart', title: '智能分段', description: '保留 MaxKB 默认分段策略，最快拿到预览。' },
  { value: 'advanced', title: '高级分段', description: '手工指定分段长度、标记规则和清洗选项。' },
  { value: 'llm_text', title: '模型分段', description: '使用 LLM 模型执行文本分段并可开启质量优化。' },
  { value: 'llm_vision', title: '视觉模型分段', description: '使用 IMAGE + LLM 组合处理图文混排文档。' },
]

function textOf(record: MaxKbRecord, keys: string[], fallback = '') {
  return helperTextOf(record, keys, fallback)
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return '0 B'
  }
  if (size < 1024) {
    return `${size} B`
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function taskStatusMeta(status: string) {
  const labels: Record<string, { text: string; color: string }> = {
    QUEUED: { text: '排队中', color: 'default' },
    PROCESSING: { text: '处理中', color: 'processing' },
    PARSING: { text: '解析中', color: 'processing' },
    PREVIEW_READY: { text: '可预览', color: 'success' },
    APPLYING: { text: '入库中', color: 'processing' },
    COMPLETED: { text: '已完成', color: 'success' },
    FAILED: { text: '失败', color: 'error' },
    CANCELLED: { text: '已取消', color: 'warning' },
    UNKNOWN: { text: '未知', color: 'default' },
  }
  return labels[status] ?? { text: status || '未知', color: 'default' }
}

function normalizeTask(payload: unknown): NormalizedTask {
  const normalized = normalizeTaskPayload(payload)
  const record = normalizeObjectPayload(payload) as MaxKbRecord
  return {
    ...normalized,
    createdAtText: textOf(record, ['create_time', 'created_at', 'createdAt'], ''),
    raw: record,
  }
}

function normalizePreviewDocuments(records: MaxKbRecord[]): PreviewDocument[] {
  const groups = new Map<string, PreviewDocument>()

  records.forEach((record, index) => {
    const documentId = textOf(record, ['document_id', 'doc_id', 'id'], String(index + 1))
    const documentName = textOf(record, ['document_name', 'name', 'title'], `文档 ${index + 1}`)
    const paragraphId = textOf(record, ['paragraph_id', 'id'], `${documentId}-${index + 1}`)
    const paragraphTitle = textOf(record, ['title', 'name'], `分段 ${index + 1}`)
    const paragraphContent = textOf(record, ['content', 'text', 'paragraph_content', 'raw_content', 'markdown', 'md', 'html'], '')
    const key = `${documentId}:${documentName}`
    const current = groups.get(key) ?? { key, name: documentName, paragraphs: [] }
    current.paragraphs.push({
      key: paragraphId,
      title: paragraphTitle,
      content: paragraphContent,
    })
    groups.set(key, current)
  })

  return Array.from(groups.values())
}

function previewEmptyText(currentTask: NormalizedTask | null) {
  if (!currentTask) {
    return '创建预览任务后会在这里显示分段结果'
  }
  if (currentTask.status === 'PREVIEW_READY') {
    return '当前任务暂无可展示的预览内容'
  }
  return '预览仍在生成中'
}

export default function MaxKbDocumentUploadWorkbench(props: Props) {
  const contextKey = `${props.accountId}:${props.knowledgeId}`
  return <WorkbenchSession key={contextKey} {...props} />
}

function WorkbenchSession({ accountId, knowledgeId, knowledgeName, onCancel, onImported }: Props) {
  const [step, setStep] = useState<UploadStep>('files')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [draggerKey, setDraggerKey] = useState(0)
  const [splitMode, setSplitMode] = useState<SplitMode>('smart')
  const [advancedLimit, setAdvancedLimit] = useState(4096)
  const [patternsText, setPatternsText] = useState('')
  const [withFilter, setWithFilter] = useState(true)
  const [qualityOptimize, setQualityOptimize] = useState(true)
  const [llmModelId, setLlmModelId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')

  const [llmModels, setLlmModels] = useState<MaxKbUploadModel[]>([])
  const [imageModels, setImageModels] = useState<MaxKbUploadModel[]>([])
  const [llmLoading, setLlmLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [llmError, setLlmError] = useState('')
  const [imageError, setImageError] = useState('')

  const [creatingPreview, setCreatingPreview] = useState(false)
  const [applyingTask, setApplyingTask] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewTaskId, setPreviewTaskId] = useState('')
  const [currentTask, setCurrentTask] = useState<NormalizedTask | null>(null)
  const [previewDocuments, setPreviewDocuments] = useState<PreviewDocument[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState<NormalizedTask[]>([])
  const [mutatingTaskId, setMutatingTaskId] = useState('')

  const pollTimerRef = useRef<number | null>(null)
  const pollGenerationRef = useRef(0)
  const previewRequestRef = useRef(0)
  const requestScopeRef = useRef(0)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      requestScopeRef.current += 1
      previewRequestRef.current += 1
      clearPollTimer()
    }
  }, [])

  useEffect(() => {
    requestScopeRef.current += 1
    previewRequestRef.current += 1
    clearPollTimer()
  }, [accountId, knowledgeId])

  const llmOptions = useMemo(() => groupModelOptions(llmModels), [llmModels])
  const imageOptions = useMemo(() => groupModelOptions(imageModels), [imageModels])
  const accept = useMemo(() => Array.from(SUPPORTED_EXTENSIONS).map((item) => `.${item}`).join(','), [])
  const currentStatus = taskStatusMeta(currentTask?.status ?? 'UNKNOWN')
  const currentStepIndex = step === 'files' ? 0 : step === 'rules' ? 1 : 2
  const currentPreviewConfirmable = currentTask ? canConfirmPreview({
    status: currentTask.status,
    taskId: currentTask.taskId,
    previewTaskId,
    previewLoading,
    previewError,
    previewRecordCount: previewDocuments.length,
  }) : false

  function clearPollTimer() {
    pollGenerationRef.current += 1
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  function canWriteRequest(capturedScope: number) {
    return aliveRef.current && isRequestScopeCurrent(capturedScope, requestScopeRef.current)
  }

  function clearPreviewState() {
    previewRequestRef.current += 1
    setPreviewLoading(false)
    setPreviewError('')
    setPreviewTaskId('')
    setPreviewDocuments([])
  }

  async function loadLlmModels() {
    const requestScope = requestScopeRef.current
    setLlmLoading(true)
    setLlmError('')
    try {
      const models = await getKnowledgeModels(accountId, 'LLM')
      if (!canWriteRequest(requestScope)) {
        return
      }
      setLlmModels(models)
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      setLlmError(error instanceof Error ? error.message : 'LLM 模型加载失败')
    } finally {
      if (canWriteRequest(requestScope)) {
        setLlmLoading(false)
      }
    }
  }

  async function loadImageModels() {
    const requestScope = requestScopeRef.current
    setImageLoading(true)
    setImageError('')
    try {
      const models = await getKnowledgeModels(accountId, 'IMAGE')
      if (!canWriteRequest(requestScope)) {
        return
      }
      setImageModels(models)
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      setImageError(error instanceof Error ? error.message : '视觉模型加载失败')
    } finally {
      if (canWriteRequest(requestScope)) {
        setImageLoading(false)
      }
    }
  }

  async function enterRulesStep() {
    setStep('rules')
    if (llmModels.length === 0 && !llmLoading) {
      void loadLlmModels()
    }
    if (imageModels.length === 0 && !imageLoading) {
      void loadImageModels()
    }
  }

  function syncTask(payload: unknown) {
    const nextTask = normalizeTask(payload)
    setCurrentTask(nextTask)
    setHistoryItems((items) => {
      const withoutCurrent = items.filter((item) => item.taskId !== nextTask.taskId)
      return [nextTask, ...withoutCurrent]
    })
    return nextTask
  }

  async function loadPreview(taskId: string, silent = false) {
    if (!taskId) {
      return
    }
    const requestScope = requestScopeRef.current
    const previewRequest = previewRequestRef.current + 1
    previewRequestRef.current = previewRequest
    setPreviewLoading(true)
    setPreviewError('')
    setPreviewTaskId('')
    setPreviewDocuments([])
    try {
      const payload = await previewKnowledgeUploadTask(accountId, knowledgeId, taskId, { page: 1, page_size: 200 })
      if (!canWriteRequest(requestScope) || !isRequestGenerationCurrent(previewRequest, previewRequestRef.current)) {
        return
      }
      const documents = normalizePreviewDocuments(extractRecords(payload))
      if (documents.length === 0) {
        setPreviewError('预览没有返回可用记录')
        return
      }
      setPreviewDocuments(documents)
      setPreviewTaskId(taskId)
      if (!silent) {
        message.success('预览已加载')
      }
    } catch (error) {
      if (!canWriteRequest(requestScope) || !isRequestGenerationCurrent(previewRequest, previewRequestRef.current)) {
        return
      }
      const nextError = error instanceof Error ? error.message : '预览加载失败'
      setPreviewDocuments([])
      setPreviewTaskId('')
      setPreviewError(nextError)
      if (!silent) {
        message.error(`预览加载失败：${nextError}`)
      }
    } finally {
      if (canWriteRequest(requestScope) && isRequestGenerationCurrent(previewRequest, previewRequestRef.current)) {
        setPreviewLoading(false)
      }
    }
  }

  async function pollTask(taskId: string, requestScope: number, pollGeneration: number) {
    if (!taskId) {
      return
    }
    try {
      const payload = await getKnowledgeUploadTask(accountId, knowledgeId, taskId)
      if (!canWriteRequest(requestScope) || !isRequestGenerationCurrent(pollGeneration, pollGenerationRef.current)) {
        return
      }
      const nextTask = syncTask(payload)
      if (nextTask.status === 'PREVIEW_READY') {
        clearPollTimer()
        void loadPreview(taskId, true)
        return
      }
      if (shouldPollStatus(nextTask.status)) {
        pollTimerRef.current = window.setTimeout(() => {
          pollTimerRef.current = null
          void pollTask(taskId, requestScope, pollGeneration)
        }, 1000)
        return
      }
      if (isTerminalStatus(nextTask.status)) {
        clearPollTimer()
      }
    } catch (error) {
      if (!canWriteRequest(requestScope) || !isRequestGenerationCurrent(pollGeneration, pollGenerationRef.current)) {
        return
      }
      clearPollTimer()
      const nextError = error instanceof Error ? error.message : '任务刷新失败'
      message.error(`任务刷新失败：${nextError}`)
    }
  }

  function beginPolling(taskId: string) {
    clearPollTimer()
    if (!taskId) {
      return
    }
    const requestScope = requestScopeRef.current
    const pollGeneration = pollGenerationRef.current
    pollTimerRef.current = window.setTimeout(() => {
      pollTimerRef.current = null
      void pollTask(taskId, requestScope, pollGeneration)
    }, 1000)
  }

  async function loadTaskHistory(silent = false) {
    const requestScope = requestScopeRef.current
    setHistoryLoading(true)
    try {
      const payload = await listKnowledgeUploadTasks(accountId, knowledgeId, { page: 1, page_size: 20 })
      if (!canWriteRequest(requestScope)) {
        return
      }
      setHistoryItems(extractRecords(payload).map((record) => normalizeTask(record)))
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      if (!silent) {
        const nextError = error instanceof Error ? error.message : '任务历史加载失败'
        message.error(`任务历史加载失败：${nextError}`)
      }
    } finally {
      if (canWriteRequest(requestScope)) {
        setHistoryLoading(false)
      }
    }
  }

  const handleDraggerChange: NonNullable<UploadProps['onChange']> = (info) => {
    const incomingFiles = info.fileList
      .map((item) => item.originFileObj)
      .filter((item): item is NonNullable<typeof item> => item instanceof File)

    if (incomingFiles.length === 0) {
      return
    }

    const result = validateIncomingFiles({ currentFiles: selectedFiles, incomingFiles })
    setSelectedFiles(result.acceptedFiles)
    result.errors.forEach((item) => message.error(item))
    setDraggerKey((value) => value + 1)
  }

  async function createPreviewTask() {
    if (selectedFiles.length === 0) {
      message.warning('请先选择文件')
      return
    }
    if (splitMode === 'advanced' && !isAdvancedLimitValid(advancedLimit)) {
      message.warning('高级分段长度必须为 50 到 100000 的整数')
      return
    }
    if (splitMode === 'llm_text' && !llmModelId) {
      message.warning('模型分段需要选择一个 LLM 模型')
      return
    }
    if (splitMode === 'llm_vision' && (!llmModelId || !visionModelId)) {
      message.warning('视觉模型分段需要同时选择 LLM 与 IMAGE 模型')
      return
    }

    const requestScope = requestScopeRef.current
    setCreatingPreview(true)
    clearPreviewState()
    try {
      const payload = await uploadKnowledgeDocuments(accountId, knowledgeId, buildUploadPayload({
        files: selectedFiles,
        splitMode,
        limit: advancedLimit,
        patternsText,
        withFilter,
        llmModelId,
        visionModelId,
        qualityOptimize,
      }))
      if (!canWriteRequest(requestScope)) {
        return
      }
      const nextTask = syncTask(payload)
      if (!nextTask.taskId) {
        message.error('预览任务缺少 task_id')
        return
      }
      if (nextTask.status === 'PREVIEW_READY') {
        void loadPreview(nextTask.taskId, true)
      } else if (shouldPollStatus(nextTask.status)) {
        beginPolling(nextTask.taskId)
      }
      void loadTaskHistory(true)
      message.success('预览任务已创建')
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      const nextError = error instanceof Error ? error.message : '预览任务创建失败'
      message.error(`预览任务创建失败：${nextError}`)
    } finally {
      if (canWriteRequest(requestScope)) {
        setCreatingPreview(false)
      }
    }
  }

  async function confirmImport(taskId: string) {
    if (!taskId) {
      return
    }
    if (!currentTask || currentTask.taskId !== taskId || !canConfirmPreview({
      status: currentTask.status,
      taskId,
      previewTaskId,
      previewLoading,
      previewError,
      previewRecordCount: previewDocuments.length,
    })) {
      message.warning('请先成功加载该任务的预览内容')
      return
    }
    const requestScope = requestScopeRef.current
    setApplyingTask(true)
    try {
      const payload = await applyKnowledgeUploadTask(accountId, knowledgeId, taskId)
      if (!canWriteRequest(requestScope)) {
        return
      }
      const nextTask = syncTask(payload)
      beginPolling(nextTask.taskId || taskId)
      setStep('success')
      void loadTaskHistory(true)
      message.success('已确认导入')
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      const nextError = error instanceof Error ? error.message : '确认导入失败'
      message.error(`确认导入失败：${nextError}`)
    } finally {
      if (canWriteRequest(requestScope)) {
        setApplyingTask(false)
      }
    }
  }

  async function cancelTask(taskId: string) {
    if (!taskId) {
      return
    }
    const requestScope = requestScopeRef.current
    setMutatingTaskId(`cancel:${taskId}`)
    try {
      await cancelKnowledgeUploadTask(accountId, knowledgeId, taskId)
      if (!canWriteRequest(requestScope)) {
        return
      }
      if (currentTask?.taskId === taskId) {
        clearPollTimer()
        setCurrentTask({ ...currentTask, status: 'CANCELLED' })
      }
      void loadTaskHistory(true)
      message.success('任务已取消')
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      const nextError = error instanceof Error ? error.message : '任务取消失败'
      message.error(`任务取消失败：${nextError}`)
    } finally {
      if (canWriteRequest(requestScope)) {
        setMutatingTaskId('')
      }
    }
  }

  async function deleteTask(taskId: string) {
    if (!taskId) {
      return
    }
    const task = historyItems.find((item) => item.taskId === taskId) ?? (currentTask?.taskId === taskId ? currentTask : null)
    if (!task || !canDeleteTask(task.status)) {
      message.warning('进行中的任务只能取消，不能删除')
      return
    }
    const requestScope = requestScopeRef.current
    if (currentTask?.taskId === taskId) {
      clearPollTimer()
      previewRequestRef.current += 1
      setPreviewLoading(false)
      setPreviewTaskId('')
    }
    setMutatingTaskId(`delete:${taskId}`)
    try {
      await deleteKnowledgeUploadTask(accountId, knowledgeId, taskId)
      if (!canWriteRequest(requestScope)) {
        return
      }
      setHistoryItems((items) => items.filter((item) => item.taskId !== taskId))
      if (currentTask?.taskId === taskId) {
        clearPollTimer()
        setCurrentTask(null)
        setPreviewDocuments([])
        setPreviewError('')
        setPreviewTaskId('')
      }
      message.success('任务记录已删除')
    } catch (error) {
      if (!canWriteRequest(requestScope)) {
        return
      }
      const nextError = error instanceof Error ? error.message : '任务删除失败'
      message.error(`任务删除失败：${nextError}`)
    } finally {
      if (canWriteRequest(requestScope)) {
        setMutatingTaskId('')
      }
    }
  }

  function restoreHistoryTask(task: NormalizedTask) {
    clearPollTimer()
    clearPreviewState()
    setCurrentTask(task)
    if (task.status === 'PREVIEW_READY') {
      void loadPreview(task.taskId, true)
      return
    }
    if (shouldPollStatus(task.status)) {
      beginPolling(task.taskId)
      return
    }
  }

  const historyItemsConfig = [
    {
      key: 'history',
      label: '任务历史',
      children: historyLoading ? (
        <div className="mkb-upload-history-loading">
          <Spin />
        </div>
      ) : historyItems.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史任务" />
      ) : (
        <List
          size="small"
          dataSource={historyItems}
          renderItem={(item) => {
            const status = taskStatusMeta(item.status)
            const previewConfirmable = canConfirmPreview({
              status: item.status,
              taskId: item.taskId,
              previewTaskId,
              previewLoading,
              previewError,
              previewRecordCount: previewDocuments.length,
            })
            return (
              <List.Item
                actions={[
                  <Button key="restore" size="small" type="text" icon={<EyeOutlined />} onClick={() => restoreHistoryTask(item)}>
                    恢复
                  </Button>,
                  previewConfirmable ? (
                    <Button key="apply" size="small" type="text" icon={<CheckCircleFilled />} onClick={() => void confirmImport(item.taskId)}>
                      确认导入
                    </Button>
                  ) : null,
                  shouldPollStatus(item.status) ? (
                    <Button
                      key="cancel"
                      size="small"
                      type="text"
                      icon={<StopOutlined />}
                      loading={mutatingTaskId === `cancel:${item.taskId}`}
                      onClick={() => void cancelTask(item.taskId)}
                    >
                      取消
                    </Button>
                  ) : null,
                  canDeleteTask(item.status) ? (
                    <Button
                      key="delete"
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      loading={mutatingTaskId === `delete:${item.taskId}`}
                      onClick={() => void deleteTask(item.taskId)}
                    >
                      删除
                    </Button>
                  ) : null,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space size={8} wrap>
                      <Text strong>{item.taskId || '未命名任务'}</Text>
                      <Tag color={status.color}>{status.text}</Tag>
                      <Text type="secondary">{item.createdAtText || '刚刚创建'}</Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={4} className="mkb-upload-history-meta">
                      <Text type="secondary">{item.stageText || '-'}</Text>
                      <Progress percent={item.progressPercent} size="small" />
                    </Space>
                  }
                />
              </List.Item>
            )
          }}
        />
      ),
    },
  ]

  return (
    <div className="mkb-upload-workbench">
      <div className="mkb-upload-header">
        <Title level={4} className="mkb-upload-title">
          导入到 {knowledgeName}
        </Title>
        <Text type="secondary">按 MaxKB 的两步流程先选文件，再生成预览并确认导入。</Text>
      </div>

      <Steps className="mkb-upload-steps" current={currentStepIndex} items={STEP_ITEMS} />

      {step === 'success' ? (
        <Result
          className="mkb-upload-success"
          status="success"
          title="导入任务已提交"
          subTitle={currentTask?.taskId ? `任务 ${currentTask.taskId} 已进入入库流程。` : '任务已进入入库流程。'}
          extra={[
            <Button key="done" type="primary" onClick={onImported}>
              返回知识库
            </Button>,
            <Button
              key="status"
              onClick={() => {
                setStep('rules')
                setHistoryOpen(true)
                void loadTaskHistory(true)
              }}
            >
              查看任务状态
            </Button>,
          ]}
        />
      ) : null}

      {step === 'files' ? (
        <div className="mkb-upload-panel mkb-upload-panel--files">
          <Alert
            className="mkb-upload-callout"
            type="info"
            showIcon
            message="普通文档上传"
            description="先选择文件，再在下一步配置分段规则并生成预览。这里保留 MaxKB 的两步导入方式，但不提供目录上传。"
          />

          <Upload.Dragger
            className="mkb-upload-dragger"
            key={draggerKey}
            multiple
            beforeUpload={() => false}
            showUploadList={false}
            accept={accept}
            onChange={handleDraggerChange}
          >
            <div className="mkb-upload-dragger-body">
              <FileTextOutlined className="mkb-upload-dragger-icon" />
              <Text strong>拖拽文件到这里，或点击选择文件</Text>
              <Text type="secondary">支持常见办公与文本格式，单个文件不超过 100MB，最多 50 个。</Text>
              <Button type="primary">选择文件</Button>
            </div>
          </Upload.Dragger>

          {selectedFiles.length > 0 ? (
            <div className="mkb-upload-file-grid">
              {selectedFiles.map((file) => (
                <Card key={file.name} size="small" className="mkb-upload-file-card">
                  <div className="mkb-upload-file-card__body">
                    <FileTextOutlined className="mkb-upload-file-card__icon" />
                    <div className="mkb-upload-file-card__meta">
                      <Text strong ellipsis={{ tooltip: file.name }} className="mkb-upload-file-card__name">
                        {file.name}
                      </Text>
                      <Text type="secondary">{formatBytes(file.size)}</Text>
                    </div>
                    <Button
                      aria-label={`删除 ${file.name}`}
                      icon={<DeleteOutlined />}
                      size="small"
                      type="text"
                      onClick={() => setSelectedFiles((items) => items.filter((item) => item.name !== file.name))}
                    />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有选择文件" />
          )}
        </div>
      ) : null}

      {step === 'rules' ? (
        <div className="mkb-upload-rules">
          <div className="mkb-upload-rule-list">
            <Alert
              className="mkb-upload-callout"
              type="info"
              showIcon
              message="第二步：规则与预览"
              description="这里创建的是 autoApply=false 的预览任务，只有在右侧确认后才会真正导入知识库。"
            />

            <div className="mkb-upload-strategy-grid">
              {STRATEGY_CARDS.map((item) => {
                const active = splitMode === item.value
                return (
                  <Card
                    key={item.value}
                    className={active ? 'mkb-upload-strategy-card is-active' : 'mkb-upload-strategy-card'}
                    hoverable
                    onClick={() => setSplitMode(item.value)}
                  >
                    <div className="mkb-upload-strategy-card__body">
                      <Space size={8}>
                        <Text strong>{item.title}</Text>
                        {active ? <Tag color="processing">当前策略</Tag> : null}
                      </Space>
                      <Text type="secondary">{item.description}</Text>
                    </div>
                  </Card>
                )
              })}
            </div>

            {splitMode === 'advanced' ? (
              <Card size="small" title="高级分段设置" className="mkb-upload-card">
                <div className="mkb-upload-form-grid">
                  <div className="mkb-upload-form-field">
                    <Text>分段长度</Text>
                    <Slider
                      min={50}
                      max={100000}
                      value={advancedLimit}
                      onChange={setAdvancedLimit}
                    />
                    <InputNumber<number>
                      min={50}
                      max={100000}
                      precision={0}
                      value={advancedLimit}
                      className="mkb-upload-input-full"
                      onChange={(value) => setAdvancedLimit(value ?? 0)}
                    />
                  </div>
                  <div className="mkb-upload-form-field">
                    <Text>分段标记</Text>
                    <Input.TextArea
                      value={patternsText}
                      placeholder="每行一个分段标记，例如 ## 或 ###"
                      autoSize={{ minRows: 3, maxRows: 6 }}
                      onChange={(event) => setPatternsText(event.target.value)}
                    />
                  </div>
                  <Checkbox checked={withFilter} onChange={(event) => setWithFilter(event.target.checked)}>
                    清洗文本 with_filter
                  </Checkbox>
                </div>
              </Card>
            ) : null}

            {splitMode === 'llm_text' ? (
              <Card
                size="small"
                title="模型分段"
                className="mkb-upload-card"
                extra={
                  <Button size="small" icon={<ReloadOutlined />} loading={llmLoading} onClick={() => void loadLlmModels()}>
                    重试 LLM
                  </Button>
                }
              >
                <div className="mkb-upload-form-grid">
                  <Select
                    showSearch
                    placeholder="选择 LLM 模型"
                    loading={llmLoading}
                    value={llmModelId || undefined}
                    options={llmOptions}
                    onChange={setLlmModelId}
                  />
                  {llmError ? <Alert type="error" showIcon message={llmError} /> : null}
                  <Checkbox checked={qualityOptimize} onChange={(event) => setQualityOptimize(event.target.checked)}>
                    高质量优化
                  </Checkbox>
                </div>
              </Card>
            ) : null}

            {splitMode === 'llm_vision' ? (
              <Card size="small" title="视觉模型分段" className="mkb-upload-card">
                <div className="mkb-upload-form-grid">
                  <Space className="mkb-upload-inline-space" wrap>
                    <Text type="secondary">视觉与文本模型支持分别重试。</Text>
                    <Space>
                      <Button size="small" icon={<ReloadOutlined />} loading={imageLoading} onClick={() => void loadImageModels()}>
                        重试 IMAGE
                      </Button>
                      <Button size="small" icon={<ReloadOutlined />} loading={llmLoading} onClick={() => void loadLlmModels()}>
                        重试 LLM
                      </Button>
                    </Space>
                  </Space>
                  <Select
                    showSearch
                    placeholder="选择 IMAGE 模型"
                    loading={imageLoading}
                    value={visionModelId || undefined}
                    options={imageOptions}
                    onChange={setVisionModelId}
                  />
                  {imageError ? <Alert type="error" showIcon message={imageError} /> : null}
                  <Select
                    showSearch
                    placeholder="选择 LLM 模型"
                    loading={llmLoading}
                    value={llmModelId || undefined}
                    options={llmOptions}
                    onChange={setLlmModelId}
                  />
                  {llmError ? <Alert type="error" showIcon message={llmError} /> : null}
                  <Checkbox checked={qualityOptimize} onChange={(event) => setQualityOptimize(event.target.checked)}>
                    高质量优化
                  </Checkbox>
                </div>
              </Card>
            ) : null}
          </div>

          <div className="mkb-upload-preview">
            <section className="mkb-upload-panel-section mkb-upload-task-panel">
              <header className="mkb-upload-panel-section__header">
                <Text strong>当前任务</Text>
                {currentTask ? (
                  <Space size={8}>
                    <Tag color={currentStatus.color}>{currentStatus.text}</Tag>
                    {shouldPollStatus(currentTask.status) ? <LoadingOutlined /> : null}
                  </Space>
                ) : null}
              </header>
              {currentTask ? (
                <div className="mkb-upload-task-summary">
                  <Progress percent={currentTask.progressPercent} />
                  <div className="mkb-upload-task-metrics">
                    <article className="mkb-upload-task-metric">
                      <Text type="secondary">阶段</Text>
                      <div><Text strong>{currentTask.stageText || '-'}</Text></div>
                    </article>
                    <article className="mkb-upload-task-metric">
                      <Text type="secondary">已处理</Text>
                      <div><Text strong>{currentTask.processedCount}</Text></div>
                    </article>
                    <article className="mkb-upload-task-metric">
                      <Text type="secondary">总数</Text>
                      <div><Text strong>{currentTask.totalCount}</Text></div>
                    </article>
                    <article className="mkb-upload-task-metric">
                      <Text type="secondary">剩余</Text>
                      <div><Text strong>{currentTask.remainingCount}</Text></div>
                    </article>
                  </div>
                  {currentTask.messageText ? (
                    <Alert type={currentTask.status === 'FAILED' ? 'error' : 'info'} showIcon message={currentTask.messageText} />
                  ) : null}
                  <Space wrap>
                    <Button icon={<ReloadOutlined />} loading={creatingPreview} onClick={() => void createPreviewTask()}>
                      重试
                    </Button>
                    {shouldPollStatus(currentTask.status) ? (
                      <Button
                        danger
                        icon={<StopOutlined />}
                        loading={mutatingTaskId === `cancel:${currentTask.taskId}`}
                        onClick={() => void cancelTask(currentTask.taskId)}
                      >
                        取消任务
                      </Button>
                    ) : null}
                    {currentPreviewConfirmable ? (
                      <Button type="primary" icon={<CheckCircleFilled />} loading={applyingTask} onClick={() => void confirmImport(currentTask.taskId)}>
                        确认导入
                      </Button>
                    ) : null}
                  </Space>
                </div>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未创建预览任务" />
              )}
            </section>

            <section className="mkb-upload-panel-section mkb-upload-preview-panel">
              <header className="mkb-upload-panel-section__header">
                <Text strong>预览内容</Text>
              </header>
              {previewLoading ? (
                <div className="mkb-upload-preview-loading">
                  <Spin />
                </div>
              ) : previewError ? (
                <Alert type="error" showIcon message={previewError} />
              ) : previewDocuments.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={previewEmptyText(currentTask)} />
              ) : (
                <div className="mkb-upload-preview-documents">
                  {previewDocuments.map((document) => (
                    <article key={document.key} className="mkb-upload-preview-card">
                      <header className="mkb-upload-preview-card__header">
                        <Text strong>{document.name}</Text>
                      </header>
                      <div className="mkb-upload-preview-card__body">
                        {document.paragraphs.map((paragraph) => (
                          <div key={paragraph.key} className="mkb-upload-preview-paragraph">
                            <Text strong>{paragraph.title}</Text>
                            <Paragraph className="mkb-upload-preview-paragraph__content">
                              {paragraph.content || '该分段没有可展示的内容。'}
                            </Paragraph>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <Collapse
              activeKey={historyOpen ? ['history'] : []}
              items={historyItemsConfig}
              onChange={(keys) => {
                const nextOpen = Array.isArray(keys) ? keys.includes('history') : keys === 'history'
                setHistoryOpen(nextOpen)
                if (nextOpen) {
                  void loadTaskHistory(true)
                }
              }}
            />
          </div>
        </div>
      ) : null}

      <div className="mkb-upload-footer">
        <Button
          onClick={() => {
            clearPollTimer()
            onCancel()
          }}
        >
          取消
        </Button>

        <Space>
          {step === 'rules' ? (
            <Button onClick={() => setStep('files')}>上一步</Button>
          ) : null}
          {step === 'files' ? (
            <Button type="primary" disabled={selectedFiles.length === 0} onClick={() => void enterRulesStep()}>
              下一步
            </Button>
          ) : null}
          {step === 'rules' ? (
            <Button type="primary" loading={creatingPreview} onClick={() => void createPreviewTask()}>
              创建预览
            </Button>
          ) : null}
        </Space>
      </div>
    </div>
  )
}
