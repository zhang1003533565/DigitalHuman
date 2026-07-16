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
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd'
import type { CollapseProps, UploadFile, UploadProps } from 'antd'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  InboxOutlined,
  ReloadOutlined,
  RobotOutlined,
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

/* TESTING_HELPERS_START */
type UploadStep = 'files' | 'rules' | 'success'
type SplitMode = 'smart' | 'advanced' | 'llm_text' | 'llm_vision'
type TaskStatus = 'QUEUED' | 'PROCESSING' | 'PREVIEW_READY' | 'APPLYING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN'
type MaxKbUploadModelLike = {
  id: string
  name: string
  model_name?: string
  model_type: 'LLM' | 'IMAGE'
  provider?: string
  scope?: 'workspace' | 'shared'
}
type BuildUploadPayloadInput = {
  files: File[]
  splitMode: SplitMode
  limit: number
  patternsText: string
  withFilter: boolean
  llmModelId: string
  visionModelId: string
  qualityOptimize: boolean
}
type ValidateIncomingFilesInput = {
  currentFiles: File[]
  incomingFiles: File[]
}
type ValidateIncomingFilesResult = {
  acceptedFiles: File[]
  errors: string[]
}
type NormalizedTaskPayload = {
  record: Record<string, unknown>
  taskId: string
  status: TaskStatus
  progressPercent: number
  processedCount: number
  totalCount: number
  remainingCount: number
  messageText: string
}

const MAX_FILE_COUNT = 50
const MAX_FILE_SIZE = 100 * 1024 * 1024
const SUPPORTED_EXTENSIONS = new Set(['txt', 'md', 'log', 'docx', 'pdf', 'html', 'zip', 'xlsx', 'xls', 'csv'])
const POLLABLE_TASK_STATUSES = new Set<TaskStatus>(['QUEUED', 'PROCESSING', 'APPLYING'])

function fileKey(file: File) {
  return `${file.name}::${file.size}::${file.lastModified}`
}

function getFileExtension(name: string) {
  const index = name.lastIndexOf('.')
  return index >= 0 ? name.slice(index + 1).toLowerCase() : ''
}

function toTaskStatus(value: unknown): TaskStatus {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (normalized === 'QUEUED' || normalized === 'PROCESSING' || normalized === 'PREVIEW_READY' || normalized === 'APPLYING'
    || normalized === 'COMPLETED' || normalized === 'FAILED' || normalized === 'CANCELLED') {
    return normalized
  }
  return 'UNKNOWN'
}

function toNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function toProgressPercent(record: Record<string, unknown>) {
  const raw = toNumber(record.progress ?? 0)
  if (raw > 0 && raw <= 1) {
    return Math.round(raw * 100)
  }
  return Math.max(0, Math.min(100, Math.round(raw)))
}

function normalizeTaskRecord(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  const record = payload as Record<string, unknown>
  if ('task_id' in record || 'status' in record || 'state' in record) {
    return record
  }
  for (const key of ['data', 'task', 'record', 'detail', 'item', 'result']) {
    const nested = normalizeTaskRecord(record[key])
    if (Object.keys(nested).length > 0 && ('task_id' in nested || 'status' in nested || 'state' in nested || 'id' in nested)) {
      return nested
    }
  }
  return record
}

function validateIncomingFiles({ currentFiles, incomingFiles }: ValidateIncomingFilesInput): ValidateIncomingFilesResult {
  const acceptedFiles = [...currentFiles]
  const knownKeys = new Set(currentFiles.map(fileKey))
  const errors: string[] = []

  for (const file of incomingFiles) {
    if (!file.size) {
      errors.push(`${file.name} 文件不能为空`)
      continue
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} 超过 100MB 限制`)
      continue
    }
    if (!SUPPORTED_EXTENSIONS.has(getFileExtension(file.name))) {
      errors.push(`${file.name} 文件类型不受支持`)
      continue
    }
    if (knownKeys.has(fileKey(file))) {
      errors.push(`${file.name} 已存在，无需重复选择`)
      continue
    }
    if (acceptedFiles.length >= MAX_FILE_COUNT) {
      errors.push(`${file.name} 超出最多 50 个文件限制`)
      continue
    }
    acceptedFiles.push(file)
    knownKeys.add(fileKey(file))
  }

  return { acceptedFiles, errors }
}

function groupModelOptions(models: MaxKbUploadModelLike[]) {
  const groups = models.reduce<Record<string, MaxKbUploadModelLike[]>>((result, model) => {
    const scopeLabel = model.scope === 'shared' ? '共享' : '工作空间'
    const providerLabel = model.provider || '其他'
    const label = `${scopeLabel} / ${providerLabel}`
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

function buildUploadPayload(input: BuildUploadPayloadInput): MaxKbUploadDocumentsPayload {
  const patterns = input.patternsText
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)

  return {
    files: input.files,
    autoApply: false,
    ...(input.splitMode === 'advanced' ? {
      limit: input.limit,
      patterns,
      withFilter: input.withFilter,
    } : {}),
    ...(input.splitMode === 'llm_text' ? {
      splitStrategy: 'llm_text',
      modelId: input.llmModelId,
      qualityOptimize: input.qualityOptimize,
    } : {}),
    ...(input.splitMode === 'llm_vision' ? {
      splitStrategy: 'llm_vision',
      visionModelId: input.visionModelId,
      llmModelId: input.llmModelId,
      qualityOptimize: input.qualityOptimize,
    } : {}),
  }
}

function normalizeTaskPayload(payload: unknown): NormalizedTaskPayload {
  const record = normalizeTaskRecord(payload)
  const status = toTaskStatus(record.status ?? record.state)
  const totalCount = toNumber(record.total ?? record.total_count ?? record.totalCount)
  const processedCount = toNumber(record.processed ?? record.processed_count ?? record.processedCount)
  const remainingCount = toNumber(record.remaining ?? record.remaining_count ?? record.remainingCount) || Math.max(totalCount - processedCount, 0)

  return {
    record,
    taskId: String(record.task_id ?? record.id ?? ''),
    status,
    progressPercent: toProgressPercent(record),
    processedCount,
    totalCount,
    remainingCount,
    messageText: String(record.message ?? record.error_message ?? record.error ?? ''),
  }
}

function shouldPollStatus(status: TaskStatus) {
  return POLLABLE_TASK_STATUSES.has(status)
}

const __TESTING__ = {
  validateIncomingFiles,
  normalizeTaskPayload,
  shouldPollStatus,
  groupModelOptions,
  buildUploadPayload,
}

void __TESTING__
/* TESTING_HELPERS_END */

type Props = {
  accountId: number
  knowledgeId: string
  knowledgeName: string
  onCancel: () => void
  onImported: () => void
}

type HistoryItem = NormalizedTaskPayload & {
  key: string
  createdAt: string
}

type PreviewItem = MaxKbRecord & {
  key: string
  titleText: string
  contentText: string
}

const MODE_OPTIONS: Array<{ value: SplitMode; title: string; description: string }> = [
  { value: 'smart', title: '智能分段', description: '使用 MaxKB 默认智能策略，无需额外模型。' },
  { value: 'advanced', title: '高级分段', description: '自定义长度、规则与过滤开关。' },
  { value: 'llm_text', title: '模型分段', description: '使用文本 LLM 做更细的语义分段。' },
  { value: 'llm_vision', title: '视觉模型分段', description: '组合文本和视觉模型处理复杂文档。' },
]

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  QUEUED: { label: '排队中', color: 'default' },
  PROCESSING: { label: '处理中', color: 'processing' },
  PREVIEW_READY: { label: '可预览', color: 'success' },
  APPLYING: { label: '入库中', color: 'processing' },
  COMPLETED: { label: '已完成', color: 'success' },
  FAILED: { label: '失败', color: 'error' },
  CANCELLED: { label: '已取消', color: 'warning' },
  UNKNOWN: { label: '未知', color: 'default' },
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`
  }
  return `${size} B`
}

function previewItemsFromPayload(payload: unknown): PreviewItem[] {
  return extractRecords(payload).map((record, index) => ({
    ...record,
    key: `preview-${record.id ?? record.paragraph_id ?? index}`,
    titleText: String(record.name ?? record.title ?? record.document_name ?? `预览片段 ${index + 1}`),
    contentText: String(record.content ?? record.text ?? record.paragraph_content ?? record.raw_content ?? ''),
  }))
}

function historyItemsFromPayload(payload: unknown): HistoryItem[] {
  return extractRecords(payload).map((record, index) => {
    const normalized = normalizeTaskPayload(record)
    return {
      ...normalized,
      key: `${normalized.taskId || 'task'}-${index}`,
      createdAt: String(record.create_time ?? record.created_at ?? record.createTime ?? ''),
    }
  })
}

function modeNeedsTextModel(mode: SplitMode) {
  return mode === 'llm_text' || mode === 'llm_vision'
}

function modeNeedsVisionModel(mode: SplitMode) {
  return mode === 'llm_vision'
}

function WorkbenchInner({ accountId, knowledgeId, knowledgeName, onCancel, onImported }: Props) {
  const [step, setStep] = useState<UploadStep>('files')
  const [files, setFiles] = useState<File[]>([])
  const [splitMode, setSplitMode] = useState<SplitMode>('smart')
  const [limit, setLimit] = useState(4096)
  const [patternsText, setPatternsText] = useState('##\n###')
  const [withFilter, setWithFilter] = useState(false)
  const [qualityOptimize, setQualityOptimize] = useState(true)
  const [llmModelId, setLlmModelId] = useState('')
  const [visionModelId, setVisionModelId] = useState('')
  const [llmModels, setLlmModels] = useState<MaxKbUploadModel[]>([])
  const [imageModels, setImageModels] = useState<MaxKbUploadModel[]>([])
  const [llmError, setLlmError] = useState('')
  const [imageError, setImageError] = useState('')
  const [loadingLlmModels, setLoadingLlmModels] = useState(false)
  const [loadingImageModels, setLoadingImageModels] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [historyOpenKeys, setHistoryOpenKeys] = useState<string[]>([])
  const [currentTask, setCurrentTask] = useState<NormalizedTaskPayload | null>(null)
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const pollTimerRef = useRef<number | null>(null)
  const requestVersionRef = useRef(0)

  const llmOptions = useMemo(() => groupModelOptions(llmModels), [llmModels])
  const imageOptions = useMemo(() => groupModelOptions(imageModels), [imageModels])
  const currentMode = MODE_OPTIONS.find((item) => item.value === splitMode) ?? MODE_OPTIONS[0]

  function clearPollTimer() {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }

  useEffect(() => () => clearPollTimer(), [])

  useEffect(() => {
    if (step !== 'rules') {
      return
    }
    const requestVersion = ++requestVersionRef.current

    async function loadTextModels() {
      setLoadingLlmModels(true)
      setLlmError('')
      try {
        const models = await getKnowledgeModels(accountId, 'LLM')
        if (requestVersion === requestVersionRef.current) {
          setLlmModels(models)
        }
      } catch (error) {
        if (requestVersion === requestVersionRef.current) {
          setLlmModels([])
          setLlmError(error instanceof Error ? error.message : '加载失败')
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setLoadingLlmModels(false)
        }
      }
    }

    async function loadVisionModels() {
      setLoadingImageModels(true)
      setImageError('')
      try {
        const models = await getKnowledgeModels(accountId, 'IMAGE')
        if (requestVersion === requestVersionRef.current) {
          setImageModels(models)
        }
      } catch (error) {
        if (requestVersion === requestVersionRef.current) {
          setImageModels([])
          setImageError(error instanceof Error ? error.message : '加载失败')
        }
      } finally {
        if (requestVersion === requestVersionRef.current) {
          setLoadingImageModels(false)
        }
      }
    }

    void loadTextModels()
    void loadVisionModels()
  }, [accountId, step])

  function retryModelLoad(modelType: 'LLM' | 'IMAGE') {
    const requestVersion = ++requestVersionRef.current

    if (modelType === 'LLM') {
      setLoadingLlmModels(true)
      setLlmError('')
      void getKnowledgeModels(accountId, 'LLM')
        .then((models) => {
          if (requestVersion === requestVersionRef.current) {
            setLlmModels(models)
          }
        })
        .catch((error: unknown) => {
          if (requestVersion === requestVersionRef.current) {
            setLlmModels([])
            setLlmError(error instanceof Error ? error.message : '加载失败')
          }
        })
        .finally(() => {
          if (requestVersion === requestVersionRef.current) {
            setLoadingLlmModels(false)
          }
        })
      return
    }

    setLoadingImageModels(true)
    setImageError('')
    void getKnowledgeModels(accountId, 'IMAGE')
      .then((models) => {
        if (requestVersion === requestVersionRef.current) {
          setImageModels(models)
        }
      })
      .catch((error: unknown) => {
        if (requestVersion === requestVersionRef.current) {
          setImageModels([])
          setImageError(error instanceof Error ? error.message : '加载失败')
        }
      })
      .finally(() => {
        if (requestVersion === requestVersionRef.current) {
          setLoadingImageModels(false)
        }
      })
  }

  function showValidationMessages(errors: string[]) {
    errors.forEach((item) => message.warning(item))
  }

  function handleUploadChange(info: { fileList: UploadFile[] }) {
    const incomingFiles = info.fileList.flatMap((item) => item.originFileObj ? [item.originFileObj as File] : [])
    const result = validateIncomingFiles({ currentFiles: files, incomingFiles })
    setFiles(result.acceptedFiles)
    showValidationMessages(result.errors)
  }

  const uploadProps: UploadProps = {
    accept: Array.from(SUPPORTED_EXTENSIONS).map((item) => `.${item}`).join(','),
    beforeUpload: () => false,
    fileList: [],
    multiple: true,
    onChange: handleUploadChange,
    showUploadList: false,
  }

  async function loadPreview(taskId: string, silent = false) {
    const requestVersion = ++requestVersionRef.current
    if (!silent) {
      setPreviewLoading(true)
    }
    try {
      const payload = await previewKnowledgeUploadTask(accountId, knowledgeId, taskId, { page: 1, page_size: 100 })
      if (requestVersion === requestVersionRef.current) {
        setPreviewItems(previewItemsFromPayload(payload))
      }
    } catch (error) {
      if (requestVersion === requestVersionRef.current) {
        setPreviewItems([])
        if (!silent) {
          message.error(`预览加载失败：${error instanceof Error ? error.message : '未知错误'}`)
        }
      }
    } finally {
      if (requestVersion === requestVersionRef.current && !silent) {
        setPreviewLoading(false)
      }
    }
  }

  async function loadTaskHistory(force = false) {
    if (historyLoaded && !force) {
      return
    }
    const requestVersion = ++requestVersionRef.current
    setHistoryLoading(true)
    try {
      const payload = await listKnowledgeUploadTasks(accountId, knowledgeId, { page: 1, page_size: 20 })
      if (requestVersion === requestVersionRef.current) {
        setHistoryItems(historyItemsFromPayload(payload))
        setHistoryLoaded(true)
      }
    } catch (error) {
      if (requestVersion === requestVersionRef.current) {
        message.error(`任务列表加载失败：${error instanceof Error ? error.message : '未知错误'}`)
      }
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setHistoryLoading(false)
      }
    }
  }

  async function syncTaskState(taskId: string) {
    const requestVersion = ++requestVersionRef.current
    const payload = await getKnowledgeUploadTask(accountId, knowledgeId, taskId)
    if (requestVersion !== requestVersionRef.current) {
      return null
    }
    const nextTask = normalizeTaskPayload(payload)
    setCurrentTask(nextTask)
    return nextTask
  }

  async function pollTask(taskId: string) {
    if (!taskId) {
      return
    }
    try {
      const nextTask = await syncTaskState(taskId)
      if (!nextTask) {
        return
      }
      if (nextTask.status === 'PREVIEW_READY') {
        clearPollTimer()
        void loadPreview(taskId, true)
        return
      }
      if (nextTask.status === 'COMPLETED') {
        clearPollTimer()
        setStep('success')
        return
      }
      if (nextTask.status === 'FAILED' || nextTask.status === 'CANCELLED') {
        clearPollTimer()
        return
      }
      if (shouldPollStatus(nextTask.status)) {
        clearPollTimer()
        pollTimerRef.current = window.setTimeout(() => {
          void pollTask(taskId)
        }, 1000)
      }
    } catch (error) {
      clearPollTimer()
      message.error(`任务状态刷新失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  function startPolling(taskId: string) {
    clearPollTimer()
    pollTimerRef.current = window.setTimeout(() => {
      void pollTask(taskId)
    }, 1000)
  }

  async function createTask() {
    if (files.length === 0) {
      message.warning('文件不能为空')
      return
    }
    if (modeNeedsTextModel(splitMode) && !llmModelId) {
      message.warning('请选择文本模型')
      return
    }
    if (modeNeedsVisionModel(splitMode) && !visionModelId) {
      message.warning('请选择视觉模型')
      return
    }

    setSubmitting(true)
    try {
      const payload = buildUploadPayload({
        files,
        splitMode,
        limit,
        patternsText,
        withFilter,
        llmModelId,
        visionModelId,
        qualityOptimize,
      })
      const response = await uploadKnowledgeDocuments(accountId, knowledgeId, payload)
      const task = normalizeTaskPayload(response)
      if (!task.taskId) {
        throw new Error('上传任务未返回 task_id')
      }
      setCurrentTask(task)
      setPreviewItems([])
      await loadTaskHistory(true)
      startPolling(task.taskId)
    } catch (error) {
      message.error(`创建上传任务失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmApply(taskId: string) {
    if (!taskId) {
      return
    }
    setSubmitting(true)
    try {
      await applyKnowledgeUploadTask(accountId, knowledgeId, taskId)
      setCurrentTask((current) => current && current.taskId === taskId ? { ...current, status: 'APPLYING' } : current)
      startPolling(taskId)
      await loadTaskHistory(true)
    } catch (error) {
      message.error(`确认导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function cancelTask(taskId: string) {
    if (!taskId) {
      return
    }
    setSubmitting(true)
    try {
      clearPollTimer()
      await cancelKnowledgeUploadTask(accountId, knowledgeId, taskId)
      const task = await syncTaskState(taskId)
      if (!task) {
        setCurrentTask((current) => current && current.taskId === taskId ? { ...current, status: 'CANCELLED' } : current)
      }
      await loadTaskHistory(true)
    } catch (error) {
      message.error(`取消任务失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteTask(taskId: string) {
    if (!taskId) {
      return
    }
    setSubmitting(true)
    try {
      await deleteKnowledgeUploadTask(accountId, knowledgeId, taskId)
      if (currentTask?.taskId === taskId) {
        setCurrentTask(null)
        setPreviewItems([])
      }
      await loadTaskHistory(true)
    } catch (error) {
      message.error(`删除任务失败：${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setSubmitting(false)
    }
  }

  function handleHistoryTask(task: HistoryItem) {
    setCurrentTask(task)
    if (task.status === 'PREVIEW_READY' || task.status === 'COMPLETED') {
      void loadPreview(task.taskId)
    } else {
      setPreviewItems([])
    }
  }

  const historyCollapseItems: CollapseProps['items'] = [
    {
      key: 'history',
      label: '任务历史',
      children: historyLoading ? <Spin /> : (
        historyItems.length === 0 ? <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : (
          <List
            dataSource={historyItems}
            renderItem={(task) => (
              <List.Item
                actions={[
                  <Button key="use" size="small" type="text" onClick={() => handleHistoryTask(task)}>查看</Button>,
                  <Button key="refresh" size="small" type="text" icon={<ReloadOutlined />} onClick={() => startPolling(task.taskId)} />,
                  <Button key="preview" size="small" type="text" icon={<EyeOutlined />} disabled={task.status !== 'PREVIEW_READY' && task.status !== 'COMPLETED'} onClick={() => void loadPreview(task.taskId)} />,
                  <Button key="apply" size="small" type="text" disabled={task.status !== 'PREVIEW_READY'} onClick={() => void confirmApply(task.taskId)}>确认导入</Button>,
                  <Button key="cancel" size="small" type="text" disabled={!shouldPollStatus(task.status)} onClick={() => void cancelTask(task.taskId)}>取消</Button>,
                  <Button key="delete" size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => void deleteTask(task.taskId)} />,
                ]}
              >
                <List.Item.Meta
                  title={(
                    <Space wrap>
                      <Text code>{task.taskId || '-'}</Text>
                      <Tag color={STATUS_META[task.status].color}>{STATUS_META[task.status].label}</Tag>
                    </Space>
                  )}
                  description={task.createdAt || `进度 ${task.progressPercent}% · ${task.processedCount}/${task.totalCount || 0}`}
                />
              </List.Item>
            )}
          />
        )
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Card>
        <Space direction="vertical" size={4}>
          <Title level={4} style={{ margin: 0 }}>MaxKB 文档上传工作台</Title>
          <Text type="secondary">知识库：{knowledgeName}。步骤一选择文件，步骤二选择分段模式和模型，预览后再确认导入。</Text>
          <Space wrap>
            <Tag color={step === 'files' ? 'processing' : 'default'}>步骤一 选择文件</Tag>
            <Tag color={step === 'rules' ? 'processing' : 'default'}>步骤二 设置规则</Tag>
            <Tag color={step === 'success' ? 'success' : 'default'}>完成</Tag>
          </Space>
        </Space>
      </Card>

      {step === 'files' ? (
        <Card>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Upload.Dragger {...uploadProps} style={{ padding: '24px 16px' }}>
              <InboxOutlined style={{ fontSize: 30 }} />
              <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>拖拽文件到此处，或点击选择文件</div>
              <div style={{ marginTop: 8, color: 'rgba(0, 0, 0, 0.45)' }}>
                支持常见办公与文本格式，单个文件不超过 100MB，最多 50 个。
              </div>
            </Upload.Dragger>

            {files.length === 0 ? (
              <Empty description="文件不能为空" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                {files.map((file) => (
                  <Card
                    key={fileKey(file)}
                    size="small"
                    styles={{ body: { padding: 12 } }}
                    extra={(
                      <Button
                        aria-label={`删除 ${file.name}`}
                        icon={<DeleteOutlined />}
                        size="small"
                        type="text"
                        onClick={() => setFiles((current) => current.filter((item) => fileKey(item) !== fileKey(file)))}
                      />
                    )}
                  >
                    <Space align="start">
                      <FileTextOutlined style={{ marginTop: 4 }} />
                      <div>
                        <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</div>
                        <Text type="secondary">{formatFileSize(file.size)}</Text>
                      </div>
                    </Space>
                  </Card>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <Button onClick={onCancel}>取消</Button>
              <Button type="primary" disabled={files.length === 0} onClick={() => setStep('rules')}>下一步</Button>
            </div>
          </Space>
        </Card>
      ) : null}

      {step === 'rules' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: 16 }}>
          <Card title="步骤二 选择模式与模型">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div style={{ display: 'grid', gap: 12 }}>
                {MODE_OPTIONS.map((option) => {
                  const active = option.value === splitMode
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSplitMode(option.value)}
                      style={{
                        textAlign: 'left',
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: `1px solid ${active ? '#1677ff' : '#d9d9d9'}`,
                        background: active ? '#f0f7ff' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{option.title}</div>
                      <div style={{ marginTop: 6, color: 'rgba(0, 0, 0, 0.45)' }}>{option.description}</div>
                    </button>
                  )
                })}
              </div>

              <Alert type="info" showIcon message={currentMode.title} description={currentMode.description} />

              {splitMode === 'advanced' ? (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <div>
                    <Text strong>高级分段长度</Text>
                    <InputNumber min={1} style={{ width: '100%', marginTop: 8 }} value={limit} onChange={(value) => setLimit(typeof value === 'number' ? value : 4096)} />
                  </div>
                  <div>
                    <Text strong>高级分段规则</Text>
                    <Input.TextArea rows={4} style={{ marginTop: 8 }} value={patternsText} onChange={(event) => setPatternsText(event.target.value)} />
                  </div>
                  <Checkbox checked={withFilter} onChange={(event) => setWithFilter(event.target.checked)}>高级分段启用过滤</Checkbox>
                </Space>
              ) : null}

              {modeNeedsTextModel(splitMode) ? (
                <div>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text strong>文本模型 UUID</Text>
                    <Button size="small" type="text" icon={<ReloadOutlined />} loading={loadingLlmModels} onClick={() => retryModelLoad('LLM')}>重试</Button>
                  </Space>
                  {llmError ? <Alert style={{ marginTop: 8 }} type="warning" showIcon message="文本模型加载失败" description="智能分段和高级分段仍可继续使用。" /> : null}
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    options={llmOptions}
                    value={llmModelId || undefined}
                    onChange={setLlmModelId}
                    loading={loadingLlmModels}
                    placeholder="选择文本模型"
                    showSearch
                  />
                  {llmError ? <Text type="secondary">{llmError}</Text> : null}
                </div>
              ) : null}

              {modeNeedsVisionModel(splitMode) ? (
                <div>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <Text strong>视觉模型 UUID</Text>
                    <Button size="small" type="text" icon={<ReloadOutlined />} loading={loadingImageModels} onClick={() => retryModelLoad('IMAGE')}>重试</Button>
                  </Space>
                  {imageError ? <Alert style={{ marginTop: 8 }} type="warning" showIcon message="视觉模型加载失败" description="请重试模型列表，或切换到不依赖视觉模型的模式。" /> : null}
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    options={imageOptions}
                    value={visionModelId || undefined}
                    onChange={setVisionModelId}
                    loading={loadingImageModels}
                    placeholder="选择视觉模型"
                    showSearch
                  />
                  {imageError ? <Text type="secondary">{imageError}</Text> : null}
                </div>
              ) : null}

              {(splitMode === 'llm_text' || splitMode === 'llm_vision') ? (
                <Checkbox checked={qualityOptimize} onChange={(event) => setQualityOptimize(event.target.checked)}>启用质量优化</Checkbox>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <Button onClick={() => setStep('files')}>上一步</Button>
                <Space wrap>
                  <Button onClick={onCancel}>取消</Button>
                  <Button type="primary" loading={submitting} onClick={() => void createTask()}>创建预览任务</Button>
                </Space>
              </div>
            </Space>
          </Card>

          <Card title="任务状态、预览与确认">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {currentTask ? (
                <>
                  <Space wrap>
                    <Text code>{currentTask.taskId}</Text>
                    <Tag color={STATUS_META[currentTask.status].color}>{STATUS_META[currentTask.status].label}</Tag>
                  </Space>
                  <Progress
                    percent={currentTask.progressPercent}
                    status={currentTask.status === 'FAILED' ? 'exception' : currentTask.status === 'COMPLETED' ? 'success' : 'active'}
                  />
                  <Text type="secondary">已处理 {currentTask.processedCount} / {currentTask.totalCount || 0}，剩余 {currentTask.remainingCount}</Text>
                  {currentTask.messageText ? <Alert type={currentTask.status === 'FAILED' ? 'error' : 'info'} showIcon message={currentTask.messageText} /> : null}
                  <Space wrap>
                    <Button icon={<ReloadOutlined />} onClick={() => startPolling(currentTask.taskId)}>刷新状态</Button>
                    <Button icon={<EyeOutlined />} disabled={currentTask.status !== 'PREVIEW_READY' && currentTask.status !== 'COMPLETED'} onClick={() => void loadPreview(currentTask.taskId)}>加载预览</Button>
                    <Button type="primary" icon={<CheckCircleOutlined />} disabled={currentTask.status !== 'PREVIEW_READY'} loading={submitting} onClick={() => void confirmApply(currentTask.taskId)}>确认导入</Button>
                    <Button danger icon={<StopOutlined />} disabled={!shouldPollStatus(currentTask.status)} loading={submitting} onClick={() => void cancelTask(currentTask.taskId)}>取消任务</Button>
                  </Space>
                </>
              ) : (
                <Empty description="先创建上传任务，再在这里查看预览和确认导入" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}

              <div>
                <Title level={5} style={{ marginTop: 0 }}>预览内容</Title>
                {previewLoading ? <Spin /> : (
                  previewItems.length === 0 ? (
                    <Empty description="暂无预览内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <List
                      dataSource={previewItems}
                      renderItem={(item) => (
                        <List.Item>
                          <Card size="small" style={{ width: '100%' }}>
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space>
                                <RobotOutlined />
                                <Text strong>{item.titleText}</Text>
                              </Space>
                              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }} ellipsis={{ rows: 6, expandable: true, symbol: '展开' }}>
                                {item.contentText || '该片段没有返回正文'}
                              </Paragraph>
                            </Space>
                          </Card>
                        </List.Item>
                      )}
                    />
                  )
                )}
              </div>

              <Collapse
                items={historyCollapseItems}
                activeKey={historyOpenKeys}
                onChange={(keys) => {
                  const nextKeys = Array.isArray(keys) ? keys.map(String) : [String(keys)]
                  setHistoryOpenKeys(nextKeys)
                  if (nextKeys.includes('history')) {
                    void loadTaskHistory()
                  }
                }}
              />
            </Space>
          </Card>
        </div>
      ) : null}

      {step === 'success' ? (
        <Card>
          <Space direction="vertical" size={16} style={{ width: '100%', alignItems: 'center', textAlign: 'center' }}>
            <CheckCircleOutlined style={{ fontSize: 40, color: '#52c41a' }} />
            <Title level={4} style={{ margin: 0 }}>导入完成</Title>
            <Text type="secondary">任务已完成入库。点击下方按钮返回上层并刷新列表。</Text>
            <Button type="primary" onClick={onImported}>返回并刷新</Button>
          </Space>
        </Card>
      ) : null}
    </div>
  )
}

export default function MaxKbDocumentUploadWorkbench(props: Props) {
  return <WorkbenchInner key={`${props.accountId}:${props.knowledgeId}`} {...props} />
}
