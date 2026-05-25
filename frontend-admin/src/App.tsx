import { type FormEvent, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  BuildOutlined,
  DatabaseOutlined,
} from '@ant-design/icons'
import {
  Layout,
  Button,
  Card,
  Form,
  Input,
  Table,
  Tag,
  Statistic,
  Row,
  Col,
  Upload,
  Select,
  Tabs,
  message,
  Drawer,
  Descriptions,
  Space,
  Typography,
  Divider,
  Modal,
  InputNumber,
  Switch,
  Progress,
  Pagination,
} from 'antd'
import type { UploadProps } from 'antd'
import type { TableColumnsType } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminSidebar from './components/AdminSidebar'
import ChatConfigPage from './pages/settings/ChatConfigPage'
import EmbeddingConfigPage from './pages/settings/EmbeddingConfigPage'
import ModelManualPage from './pages/settings/ModelManualPage'
import MultimodalConfigPage from './pages/settings/MultimodalConfigPage'
import VisionConfigPage from './pages/settings/VisionConfigPage'
import VoiceConfigPage from './pages/settings/VoiceConfigPage'
import SpotDrawer from './pages/scenic/SpotAddPage'
import SpotCategoryPage from './pages/scenic/SpotCategoryPage'
import FacilityListPage from './pages/scenic/FacilityListPage'
import TravelAnalyticsPage from './pages/scenic/TravelAnalyticsPage'
import './App.css'

const { Content } = Layout
const SESSION_STORAGE_KEY = 'digitalhuman.admin.user'

type LoginResult = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'REVIEWER' | 'KNOWLEDGE_ADMIN' | 'OBSERVER' | 'USER'
  token: string
}

type MenuKey =
  | 'dashboard'
  | 'knowledge'
  | 'spots'
  | 'spot-category'
  | 'facility-list'
  | 'routes'
  | 'avatar'
  | 'settings'
  | 'travel-analytics'
  | 'feedback'
  | 'qa'
  | 'review'
  | 'knowledge-missing'
  | 'eval'

const ADMIN_HOME_PATH = '/admin/dashboard'

const menuPathByKey: Record<MenuKey, string> = {
  dashboard: ADMIN_HOME_PATH,
  knowledge: '/admin/knowledge',
  spots: '/admin/spots',
  'spot-category': '/admin/spots/categories',
  'facility-list': '/admin/spots/facilities',
  routes: '/admin/routes',
  avatar: '/admin/avatar',
  settings: '/admin/setting',
  'travel-analytics': '/admin/travel-analytics',
  feedback: '/admin/feedback',
  qa: '/admin/qa',
  review: '/admin/review',
  'knowledge-missing': '/admin/knowledge-missing',
  eval: '/admin/eval',
}

const menuKeyByPath = new Map<string, MenuKey>(
  Object.entries(menuPathByKey).map(([key, path]) => [path, key as MenuKey]),
)

function getMenuKeyFromPath(pathname: string): MenuKey {
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (normalizedPath === '/admin/settings') {
    return 'settings'
  }
  return menuKeyByPath.get(normalizedPath) ?? 'dashboard'
}

function getPathForMenuKey(key: MenuKey) {
  return menuPathByKey[key] ?? ADMIN_HOME_PATH
}

type SpotRow = {
  key: string
  name: string
  area: string
  openHours: string
  tags: string[]
}

type RouteRow = {
  key: string
  name: string
  suitableFor: string
  duration: string
}

type FeedbackRow = {
  key: string
  traceId?: string
  question: string
  helpful: string
  rating: string
  comment: string
}

type RagTraceSummary = {
  traceId: string
  sessionId: string
  status: string
  question: string
  answerPreview?: string
  rewrittenQuestion?: string
  reviewRequired: boolean
  lowConfidence: boolean
  noAnswer: boolean
  reviewStatus?: string
  promptVersion?: string
  providerStatus?: string
  retrievalAttempts?: number
  totalDurationMs?: number
  createdAt: string
}

type RagTraceDetail = RagTraceSummary & {
  interest?: string
  failureReason?: string
  reviewReason?: string
  lowConfidenceReason?: string
  reviewStatus?: string
  reviewedAnswer?: string
  reviewComment?: string
  promptVersion?: string
  providerStatus?: string
  providerError?: string
  feedbackHelpful?: boolean
  feedbackRating?: number
  feedbackComment?: string
  contextSufficient: boolean
  qualityPassed: boolean
  citationsValid: boolean
  request?: Record<string, unknown>
  response?: {
    answer?: string
    rewrittenQuestion?: string
    graphSteps?: string[]
    chunks?: Array<Record<string, unknown>>
    retrievalTrace?: Array<Record<string, unknown>>
    nodeTimingsMs?: Record<string, number>
    qualityIssues?: string[]
    citationIssues?: string[]
    contextReason?: string
    lowConfidenceReason?: string
    promptVersion?: string
  }
}

type RagMetrics = {
  totalTraces: number
  failedTraces: number
  lowConfidenceTraces: number
  noAnswerTraces: number
  reviewRequiredTraces: number
  negativeFeedbackTraces: number
  averageDurationMs: number
  providerFailureRate: number
  lowConfidenceRate: number
  noAnswerRate: number
  reviewTriggerRate: number
  negativeFeedbackRate: number
  slowTraces: RagTraceSummary[]
  anomalyTraces: RagTraceSummary[]
  knowledgeMissingTraces: RagTraceSummary[]
  topSources?: Array<{ name: string; count: number }>
}

type RagPromptConfig = {
  version: string
  systemPrompt: string
  enabled: boolean
  createdAt?: string
  status?: string
}

type RagRetrievalConfig = {
  topK: number
  retrieveLimit: number
  rerankLimit: number
  scoreThreshold: number
  hybridEnabled: boolean
  rerankerEnabled: boolean
}

type RagEvalCase = {
  caseId: string
  question: string
  passed: boolean
  failureReason?: string
  traceId?: string
  promptVersion?: string
  topScore?: number
  retrievedChunks?: number
  citationsValid?: boolean
  lowConfidence?: boolean
  answerPreview?: string
}

type RagEvalRun = {
  id: number
  promptVersion: string
  totalCases: number
  passedCases: number
  passRate: number
  createdAt: string
  cases?: RagEvalCase[]
}

type RagPromptCompare = {
  left: RagEvalRun
  right: RagEvalRun
  passRateDelta: number
  passedCasesDelta: number
}

type KnowledgeDocumentRow = {
  key: string
  fileName: string
  sizeText: string
  updatedAt: string
  supported: boolean
}

type KnowledgeDocumentApiItem = {
  fileName?: string
  file_name?: string
  sizeBytes?: number
  size_bytes?: number
  updatedAt?: string
  updated_at?: string
  supported?: boolean
}

type KnowledgeBuildResult = {
  filesSeen: number
  filesIndexed: number
  chunksIndexed: number
  collection: string
  embeddingProvider?: string
  embeddingModel?: string
  builtAt: string
}

type KnowledgeBuildResponseApi = {
  filesSeen?: number
  files_seen?: number
  filesIndexed?: number
  files_indexed?: number
  chunksIndexed?: number
  chunks_indexed?: number
  collection?: string
  embeddingProvider?: string
  embedding_provider?: string
  embeddingModel?: string
  embedding_model?: string
}

type KnowledgeBuildTask = {
  id: number
  status: string
  fileName?: string
  embeddingProvider?: string
  embeddingModel?: string
  recreateCollection: boolean
  progress: number
  filesSeen?: number
  filesIndexed?: number
  chunksIndexed?: number
  errorMessage?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

type KnowledgeChunk = {
  id: string
  text: string
  score?: number
  payload?: {
    source_file?: string
    title?: string
    section_path?: string[]
    chunk_index?: number
    tags?: string[]
    spot_name?: string
    updated_at?: string
    disabled?: boolean
    quality_flags?: string[]
  }
}

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type DigitalHumanConfig = {
  modelId: string
  voiceId: string
  rate: number
  volume: number
  pitch: number
  welcomeText: string
  guideStyle: string
  broadcastStrategy: string
}

type ModelCategory = 'embedding' | 'speech' | 'vision' | 'chat' | 'multimodal'

const DIGITAL_HUMAN_MODEL_OPTIONS = [
  { value: 'hiyori_pro_zh', label: 'Hiyori 中文模型' },
  { value: 'kei_vowels_pro', label: 'Kei 中文口型模型' },
  { value: 'haru_greeter_pro_jp', label: 'Haru Greeter' },
  { value: 'mark_free_zh', label: 'Mark 中文模型' },
]

const DIGITAL_HUMAN_VOICE_OPTIONS = [
  { value: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声)' },
  { value: 'zh-CN-XiaoyiNeural', label: '小艺 (女声)' },
  { value: 'zh-CN-YunjianNeural', label: '云渐 (男声)' },
  { value: 'zh-CN-YunxiNeural', label: '云希 (男声)' },
  { value: 'zh-CN-YunxiaNeural', label: '云夏 (女声)' },
  { value: 'zh-CN-YunyangNeural', label: '云扬 (男声)' },
  { value: 'zh-CN-liaoning-XiaobeiNeural', label: '小北 (东北话)' },
  { value: 'zh-CN-shaanxi-XiaoniNeural', label: '小妮 (陕西话)' },
  { value: 'zh-HK-HiuGaaiNeural', label: 'Hiugaai (粤语女声)' },
  { value: 'zh-HK-HiuMaanNeural', label: 'Hiumaan (粤语女声)' },
  { value: 'zh-HK-WanLungNeural', label: 'Wanlung (粤语男声)' },
  { value: 'zh-TW-HsiaoChenNeural', label: '晓珍 (台湾女声)' },
  { value: 'zh-TW-HsiaoYuNeural', label: '晓瑜 (台湾女声)' },
  { value: 'zh-TW-YunJheNeural', label: '云哲 (台湾男声)' },
]

type AdminModelOption = {
  category: ModelCategory
  provider: string
  modelId: string
}

type AdminModelCatalog = {
  embeddingModels: AdminModelOption[]
  speechModels: AdminModelOption[]
  visionModels: AdminModelOption[]
  chatModels: AdminModelOption[]
  multimodalModels: AdminModelOption[]
}

type SpeechTestForm = {
  speechTestText: string
}

type ModelTestResponse = {
  success: boolean
  provider: string
  category: ModelCategory
  modelId: string
  message: string
  detail?: string
  audioUrl?: string
  audioFileName?: string
  caption?: string
  ocrText?: string
  modelAnswer?: string
  sceneSummary?: string
}

type TtsVoicesResponse = {
  voices: string[]
}

type TtsSynthesizeResponse = {
  success: boolean
  fileName?: string
  filePath?: string
  message?: string
  durationMs?: number
}

const spotColumns: TableColumnsType<SpotRow> = [
  { title: '景点名称', dataIndex: 'name' },
  { title: '所属园区', dataIndex: 'area' },
  { title: '开放时间', dataIndex: 'openHours' },
  {
    title: '标签',
    dataIndex: 'tags',
    render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>),
  },
]

const routeColumns: TableColumnsType<RouteRow> = [
  { title: '路线名称', dataIndex: 'name' },
  { title: '适合人群', dataIndex: 'suitableFor' },
  { title: '时长', dataIndex: 'duration' },
]

const feedbackColumns: TableColumnsType<FeedbackRow> = [
  { title: 'Trace', dataIndex: 'traceId', render: (value?: string) => value || '-' },
  { title: '问题', dataIndex: 'question' },
  { title: '帮助情况', dataIndex: 'helpful' },
  { title: '评分', dataIndex: 'rating' },
  { title: '意见', dataIndex: 'comment' },
]

const knowledgeColumns: TableColumnsType<KnowledgeDocumentRow> = [
  { title: '文件名', dataIndex: 'fileName' },
  { title: '大小', dataIndex: 'sizeText' },
  { title: '更新时间', dataIndex: 'updatedAt' },
  {
    title: '状态',
    dataIndex: 'supported',
    render: (supported: boolean) => (
      <Tag color={supported ? 'green' : 'red'}>
        {supported ? '可用' : '格式不支持'}
      </Tag>
    ),
  },
]

function applyAuthToken(token: string | null) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }
  delete axios.defaults.headers.common.Authorization
}

function getStoredUser() {
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawValue) {
    applyAuthToken(null)
    return null
  }

  try {
    const user = JSON.parse(rawValue) as LoginResult
    applyAuthToken(user.token)
    return user
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    applyAuthToken(null)
    return null
  }
}

function saveUser(user: LoginResult) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user))
  applyAuthToken(user.token)
}

function clearUser() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  applyAuthToken(null)
}

function DashboardPanel() {
  const [metrics, setMetrics] = useState<RagMetrics | null>(null)

  useEffect(() => {
    axios.get<RagMetrics>('/api/admin/guide/rag-metrics')
      .then((response) => setMetrics(response.data))
      .catch(() => setMetrics(null))
  }, [])

  return (
    <div className="admin-panel-grid">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="RAG 总请求" value={metrics?.totalTraces ?? 0} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="平均耗时" value={metrics?.averageDurationMs ?? 0} suffix="ms" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="低置信率" value={metrics?.lowConfidenceRate ?? 0} suffix="%" />
          </Card>
        </Col>
      </Row>
      <Card title="RAG 链路指标趋势">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}><Progress type="dashboard" percent={metrics?.providerFailureRate ?? 0} format={(value) => `失败 ${value}%`} /></Col>
          <Col xs={24} md={6}><Progress type="dashboard" percent={metrics?.lowConfidenceRate ?? 0} format={(value) => `低置信 ${value}%`} /></Col>
          <Col xs={24} md={6}><Progress type="dashboard" percent={metrics?.noAnswerRate ?? 0} format={(value) => `无答案 ${value}%`} /></Col>
          <Col xs={24} md={6}><Progress type="dashboard" percent={metrics?.reviewTriggerRate ?? 0} format={(value) => `人审 ${value}%`} /></Col>
        </Row>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="无答案率" value={metrics?.noAnswerRate ?? 0} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="人审触发率" value={metrics?.reviewTriggerRate ?? 0} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="差评率" value={metrics?.negativeFeedbackRate ?? 0} suffix="%" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Top 命中文档">
            <ul className="admin-list">
              {(metrics?.topSources ?? []).map((source) => (
                <li key={source.name}>{source.count} 次 · {source.name}</li>
              ))}
              {!metrics?.topSources?.length ? <li>暂无数据</li> : null}
            </ul>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="慢查询 Top20">
            <ul className="admin-list">
              {(metrics?.slowTraces ?? []).map((trace) => (
                <li key={trace.traceId}>{Math.round(trace.totalDurationMs ?? 0)}ms · {trace.question}</li>
              ))}
              {!metrics?.slowTraces?.length ? <li>暂无数据</li> : null}
            </ul>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="异常 Trace">
            <ul className="admin-list">
              {(metrics?.anomalyTraces ?? []).map((trace) => (
                <li key={trace.traceId}>{trace.status} · {trace.question}</li>
              ))}
              {!metrics?.anomalyTraces?.length ? <li>暂无数据</li> : null}
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function KnowledgePanel() {
  const [documents, setDocuments] = useState<KnowledgeDocumentRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [building, setBuilding] = useState(false)
  const [lastBuildResult, setLastBuildResult] = useState<KnowledgeBuildResult | null>(null)
  const [chunkDrawerTitle, setChunkDrawerTitle] = useState('')
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([])
  const [chunkDrawerOpen, setChunkDrawerOpen] = useState(false)
  const [buildTasks, setBuildTasks] = useState<KnowledgeBuildTask[]>([])
  const [embeddingOptions, setEmbeddingOptions] = useState<{ value: string; label: string; provider: string; modelId: string }[]>([])
  const [selectedEmbeddingModel, setSelectedEmbeddingModel] = useState<string>()
  const [documentPreview, setDocumentPreview] = useState<{ fileName: string; text: string; sections?: string[] } | null>(null)
  const [documentDiff, setDocumentDiff] = useState<Record<string, unknown> | null>(null)
  const [chunkKeyword, setChunkKeyword] = useState('')
  const [chunkPage, setChunkPage] = useState(1)
  const [chunkPageSize, setChunkPageSize] = useState(10)

  async function loadDocuments() {
    const response = await axios.get('/api/admin/knowledge/documents')
    setDocuments(
      response.data.map((item: KnowledgeDocumentApiItem) => {
        const fileName = item.fileName ?? item.file_name ?? ''
        const updatedAt = item.updatedAt ?? item.updated_at ?? ''
        const sizeBytes = item.sizeBytes ?? item.size_bytes ?? 0
        return {
          key: `${fileName}-${updatedAt}`,
          fileName,
          sizeText: formatBytes(sizeBytes),
          updatedAt: updatedAt ? new Date(updatedAt).toLocaleString('zh-CN') : '-',
          supported: Boolean(item.supported),
        }
      }).filter((item: KnowledgeDocumentRow) => item.fileName),
    )
  }

  async function loadBuildTasks() {
    const response = await axios.get<KnowledgeBuildTask[]>('/api/admin/knowledge/build-tasks')
    setBuildTasks(response.data)
  }

  async function loadEmbeddingOptions() {
    const response = await axios.get<AdminModelCatalog>('/api/admin/settings/model-options')
    const options = (response.data.embeddingModels ?? []).map((item) => ({
      value: `${item.provider}::${item.modelId}`,
      label: `${item.provider} · ${item.modelId}`,
      provider: item.provider,
      modelId: item.modelId,
    }))
    setEmbeddingOptions(options)
    setSelectedEmbeddingModel((current) => (
      current && options.some((item) => item.value === current) ? current : options[0]?.value
    ))
  }

  async function buildKnowledgeBase(recreateCollection: boolean) {
    const embeddingPayload = selectedEmbeddingPayload(embeddingOptions, selectedEmbeddingModel)
    if (!embeddingPayload) {
      message.warning('请先选择后台已配置的 embedding 模型')
      return
    }
    setBuilding(true)
    try {
      const response = await axios.post('/api/admin/knowledge/build', { recreateCollection, ...embeddingPayload })
      const result = normalizeBuildResponse(response.data)
      setLastBuildResult(result)
      message.success(
        recreateCollection
          ? `全量重建完成，已写入 ${result.chunksIndexed} 个知识块`
          : `知识库构建完成，已写入 ${result.chunksIndexed} 个知识块`,
      )
      await loadDocuments()
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '知识库构建失败，请检查 AI 服务。'
        : '知识库构建失败，请稍后重试。'
      message.error(description)
    } finally {
      setBuilding(false)
    }
  }

  async function rebuildDocument(fileName: string) {
    if (!fileName) {
      message.warning('文件名为空，无法重建')
      return
    }
    const embeddingPayload = selectedEmbeddingPayload(embeddingOptions, selectedEmbeddingModel)
    if (!embeddingPayload) {
      message.warning('请先选择后台已配置的 embedding 模型')
      return
    }
    setBuilding(true)
    try {
      const response = await axios.post('/api/admin/knowledge/build', { fileName, ...embeddingPayload })
      setLastBuildResult(normalizeBuildResponse(response.data))
      message.success(`已重建 ${fileName}`)
    } finally {
      setBuilding(false)
    }
  }

  async function submitBuildTask(recreateCollection: boolean, fileName?: string) {
    if (fileName !== undefined && !fileName) {
      message.warning('文件名为空，无法提交构建任务')
      return
    }
    const embeddingPayload = selectedEmbeddingPayload(embeddingOptions, selectedEmbeddingModel)
    if (!embeddingPayload) {
      message.warning('请先选择后台已配置的 embedding 模型')
      return
    }
    await axios.post('/api/admin/knowledge/build-tasks', { recreateCollection, fileName, ...embeddingPayload })
    message.success('构建任务已提交')
    await loadBuildTasks()
  }

  async function retryBuildTask(id: number) {
    await axios.post(`/api/admin/knowledge/build-tasks/${id}/retry`)
    await loadBuildTasks()
  }

  async function cancelBuildTask(id: number) {
    await axios.post(`/api/admin/knowledge/build-tasks/${id}/cancel`)
    await loadBuildTasks()
  }

  async function deleteDocument(fileName: string) {
    if (!fileName) {
      message.warning('文件名为空，无法删除')
      return
    }
    Modal.confirm({
      title: '删除知识文件',
      content: `确认删除 ${fileName} 并同步删除向量库中的对应知识块吗？`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const response = await axios.delete(`/api/admin/knowledge/documents/${encodeURIComponent(fileName)}`)
        message.success(`已删除 ${response.data.fileName ?? response.data.file_name}，同步移除 ${response.data.vectorsDeleted ?? response.data.vectors_deleted ?? 0} 个向量`)
        await loadDocuments()
      },
    })
  }

  async function openChunks(fileName: string) {
    if (!fileName) {
      message.warning('文件名为空，无法查看知识块')
      return
    }
    const response = await axios.get(`/api/admin/knowledge/documents/${encodeURIComponent(fileName)}/chunks`)
    setChunkDrawerTitle(fileName)
    setChunks(response.data.chunks ?? [])
    setChunkPage(1)
    setChunkDrawerOpen(true)
  }

  async function openPreview(fileName: string) {
    if (!fileName) {
      message.warning('文件名为空，无法预览')
      return
    }
    const response = await axios.get(`/api/admin/knowledge/documents/${encodeURIComponent(fileName)}/preview`)
    setDocumentPreview(response.data)
  }

  async function openDiff(fileName: string) {
    if (!fileName) {
      message.warning('文件名为空，无法查看 Diff')
      return
    }
    const response = await axios.get(`/api/admin/knowledge/documents/${encodeURIComponent(fileName)}/diff`)
    setDocumentDiff(response.data)
  }

  async function toggleChunkDisabled(chunkId: string, disabled: boolean) {
    if (!chunkId) return
    await axios.put(`/api/admin/knowledge/chunks/${encodeURIComponent(chunkId)}/disabled`, { disabled })
    message.success(disabled ? '知识块已禁用' : '知识块已启用')
    setChunks((current) => current.map((chunk) => (
      chunk.id === chunkId ? { ...chunk, payload: { ...chunk.payload, disabled } } : chunk
    )))
  }

  useEffect(() => {
    void loadDocuments()
    void loadBuildTasks()
    void loadEmbeddingOptions()
  }, [])

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(chunks.length / chunkPageSize))
    if (chunkPage > maxPage) {
      setChunkPage(maxPage)
    }
  }, [chunks.length, chunkPage, chunkPageSize])

  const pagedChunks = useMemo(() => {
    const start = (chunkPage - 1) * chunkPageSize
    return chunks.slice(start, start + chunkPageSize)
  }, [chunks, chunkPage, chunkPageSize])

  const uploadProps: UploadProps = {
    accept: '.docx,.pdf,.txt',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file as File)
        const response = await axios.post('/api/admin/knowledge/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        message.success(`上传成功，文件 ${response.data.fileName ?? response.data.file_name} 已加入待构建列表`)
        await loadDocuments()
        onSuccess?.(response.data)
      } catch (error) {
        const description = axios.isAxiosError(error)
          ? error.response?.data?.message ?? '上传失败，请检查知识库服务。'
          : '上传失败，请稍后重试。'
        message.error(description)
        onError?.(error as Error)
      } finally {
        setUploading(false)
      }
    },
  }

  const documentColumns: TableColumnsType<KnowledgeDocumentRow> = [
    ...knowledgeColumns,
    {
      title: '操作',
      width: 240,
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => void openChunks(row.fileName)}>知识块</Button>
          <Button type="link" onClick={() => void openPreview(row.fileName)}>预览</Button>
          <Button type="link" onClick={() => void openDiff(row.fileName)}>Diff</Button>
          <Button type="link" onClick={() => void submitBuildTask(false, row.fileName)}>异步重建</Button>
          <Button type="link" loading={building} onClick={() => void rebuildDocument(row.fileName)}>重建</Button>
          <Button type="link" danger onClick={() => void deleteDocument(row.fileName)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <Card
      title="知识库管理"
      extra={(
        <div className="admin-action-row">
          <Upload {...uploadProps}>
            <Button type="primary" loading={uploading}>上传文件</Button>
          </Upload>
          <Button icon={<BuildOutlined />} loading={building} onClick={() => void buildKnowledgeBase(false)}>
            开始构建
          </Button>
          <Button danger loading={building} onClick={() => void buildKnowledgeBase(true)}>
            全量重建
          </Button>
          <Button onClick={() => void submitBuildTask(false)}>异步构建</Button>
        </div>
      )}
    >
      <div className="admin-form-grid">
        <Card size="small">
          <Space wrap>
            <Typography.Text strong>构建 Embedding 模型</Typography.Text>
            <Select
              style={{ minWidth: 320 }}
              placeholder="选择后台已配置的 embedding 模型"
              value={selectedEmbeddingModel}
              onChange={setSelectedEmbeddingModel}
              options={embeddingOptions}
            />
            <Tag color="blue">构建和后续检索会使用同一个向量模型</Tag>
          </Space>
        </Card>
        <Upload {...uploadProps}>
          <Button icon={<DatabaseOutlined />} loading={uploading}>选择景区资料</Button>
        </Upload>
        <div className="admin-inline-meta">
          <Tag color="blue">支持 docx</Tag>
          <Tag color="gold">支持 pdf</Tag>
          <Tag color="purple">支持 txt</Tag>
          <Tag color="cyan">上传后需手动构建</Tag>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card size="small"><Statistic title="待构建文件数" value={documents.length} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small"><Statistic title="上次扫描文件数" value={lastBuildResult?.filesSeen ?? 0} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small"><Statistic title="上次入库文件数" value={lastBuildResult?.filesIndexed ?? 0} /></Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small"><Statistic title="上次知识块数" value={lastBuildResult?.chunksIndexed ?? 0} /></Card>
          </Col>
        </Row>
        {lastBuildResult ? (
          <Card size="small" className="admin-build-summary">
            最近一次构建写入集合 `{lastBuildResult.collection}`，共处理 {lastBuildResult.filesIndexed} 个文件，生成 {lastBuildResult.chunksIndexed} 个知识块。
            {lastBuildResult.embeddingModel ? <div>Embedding 模型：{lastBuildResult.embeddingProvider ? `${lastBuildResult.embeddingProvider} · ` : ''}{lastBuildResult.embeddingModel}</div> : null}
            <div className="admin-build-summary__time">
              构建时间：{new Date(lastBuildResult.builtAt).toLocaleString('zh-CN')}
            </div>
          </Card>
        ) : (
          <Card size="small" className="admin-build-summary admin-build-summary--muted">
            上传文件只会保存到知识库目录。点击“开始构建”后，系统才会执行文档解析、片段拆分、Embedding 和向量写入。
          </Card>
        )}
        <Table
          columns={documentColumns}
          dataSource={documents}
          pagination={false}
          locale={{ emptyText: '暂无已上传知识文件，请先上传景区资料。' }}
        />
        <Card size="small" title="构建任务">
          <Table
            rowKey="id"
            dataSource={buildTasks}
            pagination={{ pageSize: 5 }}
            columns={[
              { title: 'ID', dataIndex: 'id', width: 70 },
              { title: '状态', dataIndex: 'status', render: (value: string) => <Tag color={value === 'SUCCEEDED' ? 'green' : value === 'FAILED' ? 'red' : value === 'RUNNING' ? 'blue' : 'default'}>{value}</Tag> },
              { title: '文件', dataIndex: 'fileName', render: (value?: string) => value || '全部文件' },
              { title: 'Embedding', dataIndex: 'embeddingModel', ellipsis: true, render: (value?: string, row?: KnowledgeBuildTask) => value ? `${row?.embeddingProvider ? `${row.embeddingProvider} · ` : ''}${value}` : '-' },
              { title: '进度', dataIndex: 'progress', render: (value: number) => <Progress percent={value} size="small" /> },
              { title: '知识块', dataIndex: 'chunksIndexed', render: (value?: number) => value ?? '-' },
              { title: '错误', dataIndex: 'errorMessage', ellipsis: true, render: (value?: string) => value || '-' },
              {
                title: '操作',
                render: (_, row?: KnowledgeBuildTask) => (
                  <Space>
                    {row?.status === 'FAILED' ? <Button type="link" onClick={() => void retryBuildTask(row.id)}>重试</Button> : null}
                    {row?.status === 'PENDING' ? <Button type="link" danger onClick={() => void cancelBuildTask(row.id)}>取消</Button> : null}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </div>
      <Drawer
        title={`${chunkDrawerTitle} · 知识块`}
        open={chunkDrawerOpen}
        width={900}
        onClose={() => setChunkDrawerOpen(false)}
      >
        <Input
          allowClear
          placeholder="输入命中词高亮"
          value={chunkKeyword}
          onChange={(event) => setChunkKeyword(event.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div className="admin-inline-meta" style={{ marginBottom: 12 }}>
          <Tag color="blue">共 {chunks.length} 个知识块</Tag>
          <Tag color="cyan">第 {chunkPage} 页</Tag>
        </div>
        {renderChunkList(pagedChunks.map((chunk) => ({
          id: chunk.id,
          text: chunk.text,
          score: chunk.score,
          payload: chunk.payload,
        })), {
          highlight: chunkKeyword,
          maxItems: 0,
          itemOffset: (chunkPage - 1) * chunkPageSize,
          onToggleDisabled: (chunkId, disabled) => void toggleChunkDisabled(chunkId, disabled),
        })}
        <Pagination
          current={chunkPage}
          pageSize={chunkPageSize}
          total={chunks.length}
          showSizeChanger
          pageSizeOptions={[5, 10, 20, 50]}
          showTotal={(total, range) => `第 ${range[0]}-${range[1]} 条 / 共 ${total} 条`}
          onChange={(page, pageSize) => {
            setChunkPage(page)
            setChunkPageSize(pageSize)
          }}
          style={{ marginTop: 16, textAlign: 'right' }}
        />
      </Drawer>
      <Drawer
        title={documentPreview ? `${documentPreview.fileName} · 解析预览` : '解析预览'}
        open={Boolean(documentPreview)}
        width={820}
        onClose={() => setDocumentPreview(null)}
      >
        <Space direction="vertical" className="admin-rag-detail">
          <Space wrap>{(documentPreview?.sections ?? []).slice(0, 20).map((section) => <Tag key={section}>{section}</Tag>)}</Space>
          <Typography.Paragraph>{documentPreview?.text || '-'}</Typography.Paragraph>
        </Space>
      </Drawer>
      <Drawer
        title="文档 Diff"
        open={Boolean(documentDiff)}
        width={820}
        onClose={() => setDocumentDiff(null)}
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="当前版本">{String(documentDiff?.currentVersion ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="上一版本">{String(documentDiff?.previousVersion ?? '-')}</Descriptions.Item>
          <Descriptions.Item label="新增行">{String(documentDiff?.addedLines ?? 0)}</Descriptions.Item>
          <Descriptions.Item label="删除行">{String(documentDiff?.removedLines ?? 0)}</Descriptions.Item>
        </Descriptions>
        <pre className="admin-json-preview">{Array.isArray(documentDiff?.preview) ? documentDiff.preview.join('\n') : ''}</pre>
      </Drawer>
    </Card>
  )
}

function SpotsPanel() {
  const [data, setData] = useState<SpotRow[]>([])

  useEffect(() => {
    async function loadSpots() {
      const response = await axios.get('/api/admin/scenic/spots')
      setData(
        response.data.map((item: { id: string; name: string; area: string; openHours: string; tags: string[] }) => ({
          key: item.id,
          name: item.name,
          area: item.area,
          openHours: item.openHours,
          tags: item.tags,
        })),
      )
    }

    void loadSpots()
  }, [])

  return (
    <Card title="景点管理" extra={<Button type="primary">新增景点</Button>}>
      <Table columns={spotColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function RoutesPanel() {
  const [data, setData] = useState<RouteRow[]>([])

  useEffect(() => {
    async function loadRoutes() {
      const response = await axios.get('/api/admin/scenic/routes')
      setData(
        response.data.map((item: { id: string; name: string; suitableFor: string; duration: string }) => ({
          key: item.id,
          name: item.name,
          suitableFor: item.suitableFor,
          duration: item.duration,
        })),
      )
    }

    void loadRoutes()
  }, [])

  return (
    <Card title="路线管理" extra={<Button type="primary">创建路线</Button>}>
      <Table columns={routeColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function AvatarPanel() {
  const [form] = Form.useForm<DigitalHumanConfig>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadConfig() {
    setLoading(true)
    try {
      const response = await axios.get<DigitalHumanConfig>('/api/admin/settings/digital-human-config')
      form.setFieldsValue(response.data)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '数字人配置加载失败，请检查后端服务。'
        : '数字人配置加载失败，请稍后重试。'
      message.error(description)
    } finally {
      setLoading(false)
    }
  }

  async function saveConfig() {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await axios.put<DigitalHumanConfig>('/api/admin/settings/digital-human-config', values)
      form.setFieldsValue(response.data)
      message.success('数字人配置已保存')
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '数字人配置保存失败，请检查后端服务。'
        : '数字人配置保存失败，请稍后重试。'
      message.error(description)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    void loadConfig()
  }, [])

  return (
    <div className="admin-panel-grid">
      <Card title="数字人展示配置" extra={<Tag color="blue">游客端生效</Tag>}>
        <div className="admin-form-grid">
          <Card size="small" className="admin-build-summary">
            这里配置游客端 `/modules/digital-human` 的默认 Live2D 模型、音色、播报参数和欢迎话术。游客端只负责展示数字人和聊天。
          </Card>
          <Form form={form} layout="vertical" disabled={loading}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="默认 Live2D 模型" name="modelId" rules={[{ required: true, message: '请选择默认模型' }]}>
                  <Select options={DIGITAL_HUMAN_MODEL_OPTIONS} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="默认音色" name="voiceId" rules={[{ required: true, message: '请选择默认音色' }]}>
                  <Select options={DIGITAL_HUMAN_VOICE_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="语速" name="rate" rules={[{ required: true }]}>
                  <InputNumber min={-50} max={100} step={5} addonAfter="%" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="音量" name="volume" rules={[{ required: true }]}>
                  <InputNumber min={-50} max={50} step={5} addonAfter="%" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="音高" name="pitch" rules={[{ required: true }]}>
                  <InputNumber min={-50} max={50} step={5} addonAfter="Hz" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="默认欢迎词" name="welcomeText" rules={[{ required: true, message: '请输入默认欢迎词' }]}>
              <Input.TextArea
                rows={4}
                placeholder="例如：您好，欢迎来到灵山胜境，我可以为您介绍景点、路线和活动安排。"
              />
            </Form.Item>
            <Form.Item label="讲解风格" name="guideStyle" rules={[{ required: true, message: '请选择讲解风格' }]}>
              <Select
                options={[
                  { value: 'friendly', label: '亲切讲解' },
                  { value: 'professional', label: '专业导览' },
                  { value: 'family', label: '亲子互动' },
                ]}
              />
            </Form.Item>
            <Form.Item label="默认播报策略" name="broadcastStrategy" rules={[{ required: true, message: '请选择播报策略' }]}>
              <Select
                options={[
                  { value: 'standard', label: '标准播报' },
                  { value: 'brief', label: '简洁播报' },
                  { value: 'storytelling', label: '故事化播报' },
                ]}
              />
            </Form.Item>
            <div className="admin-action-row">
              <Button type="primary" loading={saving} onClick={() => void saveConfig()}>保存数字人配置</Button>
              <Button disabled={loading || saving} onClick={() => void loadConfig()}>重新加载</Button>
            </div>
          </Form>
        </div>
      </Card>
      <Card title="配置说明">
        <ul className="admin-list">
          <li>游客端数字人页面不再展示调试配置，只展示数字人和导览聊天。</li>
          <li>模型能力配置仍在“设置”里维护，这里只管理数字人的展示与播报默认值。</li>
          <li>保存后刷新游客端页面即可读取最新配置。</li>
        </ul>
      </Card>
    </div>
  )
}

function renderTestResult(category: ModelCategory, result?: ModelTestResponse | null) {
  if (!result) {
    return null
  }

  const isSoftSuccess = result.success && result.detail?.includes('内容为空')
  const title = result.success ? (isSoftSuccess ? '模型已连通' : '测试成功') : '测试失败'
  const summary = result.success
    ? (isSoftSuccess
      ? '接口已经打通，模型也有响应，但这次健康检查没有返回可展示文本。通常不影响继续配置使用。'
      : '模型接口调用成功，当前配置可继续使用。')
    : result.message
  const detail = result.success
    ? (isSoftSuccess ? '建议：可以继续在真实业务场景里再测一轮问答或图文输入。' : result.detail ?? '当前测试已通过。')
    : result.detail ?? '请检查提供方配置、模型名称或账户状态。'

  return (
    <Card
      size="small"
      className={`admin-build-summary ${result.success ? '' : 'admin-build-summary--danger'}`}
    >
      <div className="admin-test-result">
        <div className="admin-test-result__header">
          <strong>{title}</strong>
          <Tag color={result.success ? (isSoftSuccess ? 'blue' : 'green') : 'red'}>
            {result.success ? (isSoftSuccess ? '已连通' : '可用') : '不可用'}
          </Tag>
        </div>
        <div className="admin-test-result__meta">
          <span>模型：{result.modelId}</span>
          {result.provider ? <span>提供方：{result.provider}</span> : null}
        </div>
        <div className="admin-test-result__summary">{summary}</div>
        <div className="admin-build-summary__time">{detail}</div>
        {category === 'speech' && result.audioUrl ? (
          <div className="admin-test-result__audio">
            <strong>试听音频</strong>
            <audio controls src={result.audioUrl} className="admin-test-result__player" />
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function renderTabLabel(label: string, result?: ModelTestResponse | null) {
  return (
    <span className="admin-tab-label">
      <span>{label}</span>
      {result ? (
        <Tag color={result.success ? 'green' : 'red'} className="admin-tab-label__tag">
          {result.success ? '已通过' : '失败'}
        </Tag>
      ) : null}
    </span>
  )
}

function SettingsPanel() {
  const [form] = Form.useForm<AdminModelSettings>()
  const [speechTestForm] = Form.useForm<SpeechTestForm>()
  const [promptForm] = Form.useForm<RagPromptConfig>()
  const [retrievalForm] = Form.useForm<RagRetrievalConfig>()
  const [activeSettingsTab, setActiveSettingsTab] = useState('embedding')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [voiceOptions, setVoiceOptions] = useState<{ value: string; label: string }[]>([])
  const [testingCategory, setTestingCategory] = useState<ModelCategory | null>(null)
  const [deletingModelOption, setDeletingModelOption] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Partial<Record<ModelCategory, ModelTestResponse>>>({})
  const [promptLoading, setPromptLoading] = useState(false)
  const [promptVersions, setPromptVersions] = useState<RagPromptConfig[]>([])
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [catalog, setCatalog] = useState<AdminModelCatalog>({
    embeddingModels: [],
    speechModels: [],
    visionModels: [],
    chatModels: [],
    multimodalModels: [],
  })

  const embeddingOptions = useMemo(
    () => catalog.embeddingModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.embeddingModels],
  )
  const visionOptions = useMemo(
    () => catalog.visionModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.visionModels],
  )
  const chatOptions = useMemo(
    () => catalog.chatModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.chatModels],
  )
  const multimodalOptions = useMemo(
    () => catalog.multimodalModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.multimodalModels],
  )

  async function loadSettings() {
    setLoading(true)
    try {
      const [settingsResponse, catalogResponse] = await Promise.all([
        axios.get<AdminModelSettings>('/api/admin/settings/models'),
        axios.get<AdminModelCatalog>('/api/admin/settings/model-options'),
      ])
      form.setFieldsValue(settingsResponse.data)
      setCatalog(catalogResponse.data)
      speechTestForm.setFieldsValue({
        speechTestText: '您好，欢迎来到灵山胜境，这是一段语音测试。',
      })
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '模型设置加载失败，请检查后端服务。'
        : '模型设置加载失败，请稍后重试。'
      message.error(description)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
    void loadPrompt()
  }, [])

  async function loadPrompt() {
    setPromptLoading(true)
    try {
      const response = await axios.get<RagPromptConfig>('/api/admin/settings/rag-prompt')
      promptForm.setFieldsValue(response.data)
      const [versionsResponse, retrievalResponse, healthResponse] = await Promise.all([
        axios.get<RagPromptConfig[]>('/api/admin/settings/rag-prompts'),
        axios.get<RagRetrievalConfig>('/api/admin/settings/rag-retrieval-config'),
        axios.get<Record<string, unknown>>('/api/admin/settings/ai-health'),
      ])
      setPromptVersions(versionsResponse.data)
      retrievalForm.setFieldsValue(retrievalResponse.data)
      setHealth(healthResponse.data)
    } finally {
      setPromptLoading(false)
    }
  }

  async function savePrompt() {
    const values = await promptForm.validateFields()
    setPromptLoading(true)
    try {
      await axios.put('/api/admin/settings/rag-prompt', values)
      message.success('RAG Prompt 已保存')
      await loadPrompt()
    } finally {
      setPromptLoading(false)
    }
  }

  async function publishPrompt(version: string) {
    setPromptLoading(true)
    try {
      await axios.post(`/api/admin/settings/rag-prompts/${encodeURIComponent(version)}/publish`)
      message.success('Prompt 版本已发布')
      await loadPrompt()
    } finally {
      setPromptLoading(false)
    }
  }

  async function saveRetrievalConfig() {
    const values = await retrievalForm.validateFields()
    await axios.put('/api/admin/settings/rag-retrieval-config', values)
    message.success('检索策略已保存')
  }

  useEffect(() => {
    async function loadVoices() {
      try {
        const response = await axios.get<TtsVoicesResponse>('/api/tts/voices')
        setVoiceOptions(
          (response.data.voices ?? []).map((voice) => ({
            value: voice,
            label: voice,
          })),
        )
      } catch {
        setVoiceOptions([])
      }
    }

    void loadVoices()
  }, [])

  const fieldNameByCategory: Record<ModelCategory, keyof AdminModelSettings> = {
    embedding: 'embeddingModel',
    speech: 'speechModel',
    vision: 'visionModel',
    chat: 'chatModel',
    multimodal: 'multimodalModel',
  }

  const handleDeleteModelOption = async (category: ModelCategory, option: { value: string; provider?: string }) => {
    setDeletingModelOption(`${category}:${option.provider ?? ''}:${option.value}`)
    try {
      const response = await axios.post<AdminModelCatalog>('/api/admin/settings/model-options/delete', {
        category,
        provider: option.provider,
        modelId: option.value,
      })
      setCatalog(response.data)
      const fieldName = fieldNameByCategory[category]
      if (form.getFieldValue(fieldName) === option.value) {
        form.setFieldValue(fieldName, '')
      }
      message.success(`已删除模型 ${option.value}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '删除模型失败，请检查后端服务。'
        : '删除模型失败，请稍后重试。'
      message.error(description)
    } finally {
      setDeletingModelOption(null)
    }
  }

  const handleSave = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const response = await axios.put<AdminModelSettings>('/api/admin/settings/models', values)
        form.setFieldsValue(response.data)
      message.success('模型设置已保存')
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '模型设置保存失败，请检查后端服务。'
        : '模型设置保存失败，请稍后重试。'
      message.error(description)
    } finally {
      setSaving(false)
    }
  }

  const handleTestModel = async (category: ModelCategory, payload?: { promptText?: string; imageDataUrl?: string; mode?: string }) => {
    const fieldName = fieldNameByCategory[category]
    const values = await form.validateFields([fieldName])
    const modelId = values[fieldName] as string
    const speechValues = category === 'speech' ? await speechTestForm.validateFields(['speechTestText']) : null
    setTestingCategory(category)
    try {
      const response = await axios.post<ModelTestResponse>('/api/admin/settings/model-test', {
        category,
        modelId,
        text: category === 'speech' ? speechValues?.speechTestText : payload?.promptText,
        imageDataUrl: payload?.imageDataUrl,
        mode: payload?.mode,
      })

      let nextResult: ModelTestResponse = response.data
      if (category === 'speech') {
        const synthesizeResponse = await axios.post<TtsSynthesizeResponse>('/api/tts/synthesize', {
          text: speechValues?.speechTestText,
          voice: modelId,
        })
        if (synthesizeResponse.data.success && synthesizeResponse.data.filePath) {
          nextResult = {
            ...nextResult,
            audioUrl: synthesizeResponse.data.filePath,
            audioFileName: synthesizeResponse.data.fileName,
          }
        }
      }

      setTestResults((current) => ({
        ...current,
        [category]: nextResult,
      }))
      message.success(response.data.message)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '模型测试失败，请检查服务配置。'
        : '模型测试失败，请稍后重试。'
      setTestResults((current) => ({
        ...current,
        [category]: {
          success: false,
          provider: '',
          category,
          modelId,
          message: description,
        },
      }))
      message.error(description)
    } finally {
      setTestingCategory(null)
    }
  }

  const settingsTabs = [
    {
      key: 'embedding',
      label: renderTabLabel('嵌入模型', testResults.embedding),
      children: (
        <EmbeddingConfigPage
          form={form}
          loading={loading}
          saving={saving}
          testing={testingCategory === 'embedding'}
          options={embeddingOptions.map((item) => ({ value: item.value, provider: item.label.split(' · ')[0] }))}
          onSave={() => void handleSave()}
          onTest={() => void handleTestModel('embedding')}
          onDeleteOption={(option) => void handleDeleteModelOption('embedding', option)}
          deletingModel={deletingModelOption?.startsWith('embedding:') ? deletingModelOption.split(':').slice(2).join(':') : null}
          result={renderTestResult('embedding', testResults.embedding)}
        />
      ),
    },
    {
      key: 'speech',
      label: renderTabLabel('语音音色', testResults.speech),
      children: (
        <VoiceConfigPage
          form={form}
          speechTestForm={speechTestForm}
          loading={loading}
          saving={saving}
          testing={testingCategory === 'speech'}
          options={voiceOptions}
          onSave={() => void handleSave()}
          onTest={() => void handleTestModel('speech')}
          onReset={() => {
            form.resetFields(['speechModel'])
            speechTestForm.resetFields()
          }}
          result={renderTestResult('speech', testResults.speech)}
        />
      ),
    },
    {
      key: 'vision',
      label: renderTabLabel('视觉模型', testResults.vision),
      children: (
        <VisionConfigPage
          form={form}
          loading={loading}
          saving={saving}
          testing={testingCategory === 'vision'}
          options={visionOptions.map((item) => ({ value: item.value, provider: item.label.split(' · ')[0] }))}
          onOpenManual={() => setActiveSettingsTab('model-catalog')}
          onSave={() => void handleSave()}
          onTest={(payload) => void handleTestModel('vision', payload)}
          testResult={testResults.vision}
          result={renderTestResult('vision', testResults.vision)}
        />
      ),
    },
    {
      key: 'chat',
      label: renderTabLabel('对话模型', testResults.chat),
      children: (
        <ChatConfigPage
          form={form}
          loading={loading}
          saving={saving}
          testing={testingCategory === 'chat'}
          options={chatOptions.map((item) => ({ value: item.value, provider: item.label.split(' · ')[0] }))}
          onSave={() => void handleSave()}
          onTest={() => void handleTestModel('chat')}
          result={renderTestResult('chat', testResults.chat)}
        />
      ),
    },
    {
      key: 'multimodal',
      label: renderTabLabel('多模态模型', testResults.multimodal),
      children: (
        <MultimodalConfigPage
          form={form}
          loading={loading}
          saving={saving}
          testing={testingCategory === 'multimodal'}
          options={multimodalOptions.map((item) => ({ value: item.value, provider: item.label.split(' · ')[0] }))}
          onOpenManual={() => setActiveSettingsTab('model-catalog')}
          onSave={() => void handleSave()}
          onTest={(payload) => void handleTestModel('multimodal', payload)}
          testResult={testResults.multimodal}
          result={renderTestResult('multimodal', testResults.multimodal)}
        />
      ),
    },
    {
      key: 'model-catalog',
      label: '手动维护',
      children: <ModelManualPage />,
    },
    {
      key: 'rag-prompt',
      label: 'RAG Prompt',
      children: (
        <Space direction="vertical" size="large" className="admin-rag-detail">
          <Card size="small" extra={<Button type="primary" loading={promptLoading} onClick={() => void savePrompt()}>保存为版本</Button>}>
            <Form form={promptForm} layout="vertical">
              <Form.Item name="version" label="版本号" rules={[{ required: true }]}>
                <Input placeholder="rag-grounded-v2" />
              </Form.Item>
              <Form.Item name="enabled" label="保存后立即启用" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="systemPrompt" label="System Prompt" rules={[{ required: true, min: 20 }]}>
                <Input.TextArea rows={10} />
              </Form.Item>
              <Button loading={promptLoading} onClick={() => void loadPrompt()}>重新加载</Button>
            </Form>
          </Card>
          <Card size="small" title="版本发布/回滚">
            <Table
              rowKey="version"
              dataSource={promptVersions}
              pagination={false}
              columns={[
                { title: '版本', dataIndex: 'version' },
                { title: '状态', dataIndex: 'status', render: (value?: string, row?: RagPromptConfig) => <Tag color={row?.enabled ? 'green' : 'default'}>{value || (row?.enabled ? 'ACTIVE' : 'DRAFT')}</Tag> },
                { title: '创建时间', dataIndex: 'createdAt', render: (value?: string) => value ? new Date(value).toLocaleString('zh-CN') : '-' },
                { title: '操作', render: (_, row?: RagPromptConfig) => <Button type="link" disabled={!row || row.enabled} onClick={() => row && void publishPrompt(row.version)}>发布/回滚</Button> },
              ]}
            />
          </Card>
        </Space>
      ),
    },
    {
      key: 'rag-retrieval',
      label: 'RAG 检索策略',
      children: (
        <Space direction="vertical" size="large" className="admin-rag-detail">
          <Card size="small" extra={<Button type="primary" onClick={() => void saveRetrievalConfig()}>保存检索策略</Button>}>
            <Form form={retrievalForm} layout="vertical">
              <Row gutter={16}>
                <Col xs={24} md={8}><Form.Item name="topK" label="topK"><InputNumber min={1} max={50} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="retrieveLimit" label="召回上限"><InputNumber min={1} max={100} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="rerankLimit" label="rerank 上限"><InputNumber min={1} max={50} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="scoreThreshold" label="低置信阈值"><InputNumber min={0} max={1} step={0.01} /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="hybridEnabled" label="混合检索" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col xs={24} md={8}><Form.Item name="rerankerEnabled" label="Reranker" valuePropName="checked"><Switch /></Form.Item></Col>
              </Row>
            </Form>
          </Card>
          <Card size="small" title="ai-service 健康检查">
            <pre className="admin-json-preview">{JSON.stringify(health, null, 2)}</pre>
          </Card>
        </Space>
      ),
    },
  ]

  return (
    <div className="admin-panel-grid">
      <Card title="系统设置" extra={<Tag color="blue">左下角入口</Tag>} className="admin-settings-card">
        <Tabs activeKey={activeSettingsTab} onChange={setActiveSettingsTab} items={settingsTabs} />
      </Card>
    </div>
  )
}

function FeedbackPanel() {
  const [data, setData] = useState<FeedbackRow[]>([])

  useEffect(() => {
    async function loadFeedback() {
      const response = await axios.get('/api/admin/guide/feedback')
      setData(
        response.data.map(
          (item: { sessionId: string; traceId?: string; question: string; helpful: boolean; rating: number; comment: string }) => ({
            key: `${item.sessionId}-${item.question}`,
            traceId: item.traceId,
            question: item.question,
            helpful: item.helpful ? '有帮助' : '待优化',
            rating: `${item.rating}/5`,
            comment: item.comment || '-',
          }),
        ),
      )
    }

    void loadFeedback()
  }, [])

  return (
    <Card title="游客反馈分析">
      <Table columns={feedbackColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function getRagStatusTag(status: string) {
  const statusMap: Record<string, { color: string; label: string }> = {
    SUCCESS: { color: 'green', label: '正常' },
    LOW_CONFIDENCE: { color: 'gold', label: '低置信' },
    NO_ANSWER: { color: 'orange', label: '无答案' },
    FAILED: { color: 'red', label: '失败' },
  }
  const item = statusMap[status] ?? { color: 'default', label: status }
  return <Tag color={item.color}>{item.label}</Tag>
}

function getTextField(value: unknown, fallback = '-') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function getNumberField(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

function renderChunkList(
  chunks?: Array<Record<string, unknown>>,
  options?: {
    highlight?: string
    maxItems?: number
    itemOffset?: number
    onToggleDisabled?: (chunkId: string, disabled: boolean) => void
  },
) {
  if (!chunks?.length) {
    return <Typography.Text type="secondary">暂无片段</Typography.Text>
  }

  const visibleChunks = options?.maxItems === 0 ? chunks : chunks.slice(0, options?.maxItems ?? 8)
  const itemOffset = options?.itemOffset ?? 0

  return (
    <div className="admin-rag-chunk-list">
      {visibleChunks.map((chunk, index) => {
        const payload = (chunk.payload ?? {}) as Record<string, unknown>
        const source = getTextField(payload.source_file)
        const sectionPath = Array.isArray(payload.section_path) ? payload.section_path.join(' / ') : getTextField(payload.title)
        const score = getNumberField(chunk.score)
        const text = getTextField(chunk.text, '')
        const disabled = Boolean(payload.disabled)
        const backendFlags = Array.isArray(payload.quality_flags) ? payload.quality_flags.map(String) : []
        const qualityIssues = [
          ...backendFlags,
          !text.trim() ? '空内容' : '',
          text.length > 0 && text.length < 40 ? '过短' : '',
          text.length > 900 ? '过长' : '',
        ].filter(Boolean)
        const highlightedText = options?.highlight ? highlightText(text, options.highlight) : text
        return (
          <div className="admin-rag-chunk" key={`${getTextField(chunk.id, String(index))}-${index}`}>
            <div className="admin-rag-chunk__meta">
              <Tag color="blue">#{itemOffset + index + 1}</Tag>
              {score !== undefined ? <Tag color="purple">{score.toFixed(4)}</Tag> : null}
              {disabled ? <Tag color="red">已禁用</Tag> : null}
              {qualityIssues.map((issue) => <Tag color="orange" key={issue}>{issue}</Tag>)}
              <span>{source}</span>
              <span>{sectionPath}</span>
              {options?.onToggleDisabled ? (
                <Button
                  size="small"
                  onClick={() => options.onToggleDisabled?.(getTextField(chunk.id, ''), !disabled)}
                >
                  {disabled ? '启用' : '禁用'}
                </Button>
              ) : null}
            </div>
            <Typography.Paragraph ellipsis={{ rows: 3, expandable: true, symbol: '展开' }}>
              {highlightedText}
            </Typography.Paragraph>
          </div>
        )
      })}
    </div>
  )
}

function highlightText(text: string, keyword: string) {
  const normalized = keyword.trim()
  if (!normalized || !text.includes(normalized)) {
    return text
  }
  const parts = text.split(normalized)
  return parts.flatMap((part, index) => (
    index === parts.length - 1
      ? [part]
      : [part, <mark key={`${normalized}-${index}`}>{normalized}</mark>]
  ))
}

function renderRetrievalTrace(trace?: Array<Record<string, unknown>>) {
  if (!trace?.length) {
    return <Typography.Text type="secondary">暂无检索详情</Typography.Text>
  }

  return (
    <div className="admin-rag-attempts">
      {trace.map((attempt, index) => {
        const dense = (attempt.dense ?? {}) as { chunks?: Array<Record<string, unknown>> }
        const reranked = (attempt.reranked ?? {}) as { chunks?: Array<Record<string, unknown>> }
        return (
          <div className="admin-rag-attempt" key={`${getTextField(attempt.name, 'attempt')}-${index}`}>
            <Typography.Title level={5}>
              {getTextField(attempt.name, `第 ${index + 1} 次检索`)} · {getTextField(attempt.query)}
            </Typography.Title>
            <div className="admin-rag-compare">
              <div>
                <Typography.Text strong>向量召回</Typography.Text>
                {renderChunkList(dense.chunks)}
              </div>
              <div>
                <Typography.Text strong>Rerank 后</Typography.Text>
                {renderChunkList(reranked.chunks)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function QaPanel() {
  const [data, setData] = useState<RagTraceSummary[]>([])
  const [detail, setDetail] = useState<RagTraceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  async function loadTraces(values?: { keyword?: string; status?: string }) {
    setLoading(true)
    try {
      const response = await axios.get<RagTraceSummary[]>('/api/admin/guide/rag-traces', {
        params: {
          keyword: values?.keyword,
          status: values?.status ?? 'all',
        },
      })
      setData(response.data)
    } finally {
      setLoading(false)
    }
  }

  async function openDetail(traceId: string) {
    setDetailLoading(true)
    try {
      const response = await axios.get<RagTraceDetail>(`/api/admin/guide/rag-traces/${traceId}`)
      setDetail(response.data)
    } finally {
      setDetailLoading(false)
    }
  }

  async function copyTraceId(traceId: string) {
    await navigator.clipboard.writeText(traceId)
    message.success('TraceId 已复制')
  }

  useEffect(() => {
    void loadTraces()
  }, [])

  const columns: TableColumnsType<RagTraceSummary> = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => getRagStatusTag(status),
    },
    {
      title: '问题',
      dataIndex: 'question',
      render: (question: string, row) => (
        <div>
          <Typography.Text strong>{question}</Typography.Text>
          <div className="admin-rag-trace-id">{row.traceId}</div>
        </div>
      ),
    },
    {
      title: '改写问题',
      dataIndex: 'rewrittenQuestion',
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: '检索',
      dataIndex: 'retrievalAttempts',
      width: 90,
      render: (value?: number) => value ?? '-',
    },
    {
      title: '耗时',
      dataIndex: 'totalDurationMs',
      width: 110,
      render: (value?: number) => (value === undefined || value === null ? '-' : `${Math.round(value)} ms`),
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (value: string) => new Date(value).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      width: 90,
      render: (_, row) => (
        <Button type="link" onClick={() => void openDetail(row.traceId)}>
          详情
        </Button>
      ),
    },
  ]

  return (
    <Card title="RAG 调试中心">
      <Form layout="inline" className="admin-filter-row" onFinish={(values) => void loadTraces(values)}>
        <Form.Item label="关键词" name="keyword">
          <Input placeholder="搜索问题关键词" />
        </Form.Item>
        <Form.Item label="状态" name="status" initialValue="all">
          <Select
            style={{ width: 180 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'SUCCESS', label: '正常' },
              { value: 'LOW_CONFIDENCE', label: '低置信' },
              { value: 'NO_ANSWER', label: '无答案' },
              { value: 'FAILED', label: '失败' },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>查询</Button>
        <Button onClick={() => void loadTraces()} loading={loading}>刷新</Button>
      </Form>
      <Table
        rowKey="traceId"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      <Drawer
        title={detail ? `RAG Trace · ${detail.traceId}` : 'RAG Trace'}
        open={Boolean(detail)}
        width={960}
        onClose={() => setDetail(null)}
      >
        {detailLoading ? <Typography.Text type="secondary">正在加载详情...</Typography.Text> : null}
        {detail ? (
          <Space direction="vertical" size="large" className="admin-rag-detail">
            <Space>
              <Button onClick={() => void copyTraceId(detail.traceId)}>复制 TraceId</Button>
            </Space>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="状态">{getRagStatusTag(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="耗时">{detail.totalDurationMs ? `${Math.round(detail.totalDurationMs)} ms` : '-'}</Descriptions.Item>
              <Descriptions.Item label="会话">{detail.sessionId}</Descriptions.Item>
              <Descriptions.Item label="检索次数">{detail.retrievalAttempts ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Prompt">{detail.promptVersion || detail.response?.promptVersion || '-'}</Descriptions.Item>
              <Descriptions.Item label="Provider">{detail.providerStatus || '-'}</Descriptions.Item>
              <Descriptions.Item label="Provider错误" span={2}>{detail.providerError || '-'}</Descriptions.Item>
              <Descriptions.Item label="用户反馈" span={2}>
                {detail.feedbackRating ? `${detail.feedbackHelpful ? '有帮助' : '待优化'} · ${detail.feedbackRating}/5 · ${detail.feedbackComment || '-'}` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="问题" span={2}>{detail.question}</Descriptions.Item>
              <Descriptions.Item label="改写问题" span={2}>{detail.response?.rewrittenQuestion ?? detail.rewrittenQuestion ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="低置信原因" span={2}>{detail.lowConfidenceReason || detail.response?.lowConfidenceReason || '-'}</Descriptions.Item>
              <Descriptions.Item label="审核原因" span={2}>{detail.reviewReason || '-'}</Descriptions.Item>
              <Descriptions.Item label="失败原因" span={2}>{detail.failureReason || '-'}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Title level={5}>Graph Steps</Typography.Title>
              <Space wrap>
                {(detail.response?.graphSteps ?? []).map((step) => <Tag key={step}>{step}</Tag>)}
              </Space>
            </div>

            <div>
              <Typography.Title level={5}>回答</Typography.Title>
              <Typography.Paragraph>{detail.response?.answer ?? detail.answerPreview ?? '-'}</Typography.Paragraph>
            </div>

            <div>
              <Typography.Title level={5}>质量检查</Typography.Title>
              <Space wrap>
                <Tag color={detail.contextSufficient ? 'green' : 'red'}>上下文{detail.contextSufficient ? '充足' : '不足'}</Tag>
                <Tag color={detail.qualityPassed ? 'green' : 'red'}>质量{detail.qualityPassed ? '通过' : '未通过'}</Tag>
                <Tag color={detail.citationsValid ? 'green' : 'red'}>引用{detail.citationsValid ? '通过' : '未通过'}</Tag>
              </Space>
              <Typography.Paragraph className="admin-rag-issues">
                {[detail.response?.contextReason, ...(detail.response?.qualityIssues ?? []), ...(detail.response?.citationIssues ?? [])]
                  .filter(Boolean)
                  .join('；') || '暂无问题'}
              </Typography.Paragraph>
            </div>

            <Divider />
            <div>
              <Typography.Title level={5}>最终片段</Typography.Title>
              {renderChunkList(detail.response?.chunks)}
            </div>

            <Divider />
            <div>
              <Typography.Title level={5}>检索可视化</Typography.Title>
              {renderRetrievalTrace(detail.response?.retrievalTrace)}
            </div>
          </Space>
        ) : null}
      </Drawer>
    </Card>
  )
}

function ReviewPanel() {
  const [data, setData] = useState<RagTraceSummary[]>([])
  const [detail, setDetail] = useState<RagTraceDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [reviewForm] = Form.useForm()

  async function loadQueue(status = 'PENDING') {
    setLoading(true)
    try {
      const response = await axios.get<RagTraceSummary[]>('/api/admin/guide/rag-reviews', { params: { status } })
      setData(response.data)
      const statsResponse = await axios.get<Record<string, number>>('/api/admin/guide/rag-review-stats')
      setStats(statsResponse.data)
    } finally {
      setLoading(false)
    }
  }

  async function openReview(traceId: string) {
    const response = await axios.get<RagTraceDetail>(`/api/admin/guide/rag-traces/${traceId}`)
    setDetail(response.data)
    reviewForm.setFieldsValue({
      reviewedAnswer: response.data.reviewedAnswer || response.data.response?.answer || '',
      comment: response.data.reviewComment || '',
    })
  }

  async function submitReview(action: string) {
    if (!detail) return
    const values = reviewForm.getFieldsValue()
    await axios.post(`/api/admin/guide/rag-reviews/${detail.traceId}`, {
      action,
      reviewedAnswer: values.reviewedAnswer,
      comment: values.comment,
    })
    message.success('审核结果已保存')
    setDetail(null)
    await loadQueue()
  }

  useEffect(() => {
    void loadQueue()
  }, [])

  const columns: TableColumnsType<RagTraceSummary> = [
    { title: '状态', dataIndex: 'reviewStatus', width: 120, render: (value?: string) => <Tag color={value === 'PENDING' ? 'gold' : 'green'}>{value || '-'}</Tag> },
    { title: '问题', dataIndex: 'question' },
    { title: '原因', dataIndex: 'answerPreview', ellipsis: true },
    { title: '时间', dataIndex: 'createdAt', width: 180, render: (value: string) => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', width: 90, render: (_, row) => <Button type="link" onClick={() => void openReview(row.traceId)}>审核</Button> },
  ]

  return (
    <Card title="人工审核队列">
      <Row gutter={[16, 16]} className="admin-metric-row">
        <Col xs={12} md={4}><Statistic title="待处理" value={stats.pending ?? 0} /></Col>
        <Col xs={12} md={4}><Statistic title="通过率" value={stats.passRate ?? 0} suffix="%" /></Col>
        <Col xs={12} md={4}><Statistic title="驳回率" value={stats.rejectRate ?? 0} suffix="%" /></Col>
        <Col xs={12} md={4}><Statistic title="知识缺失率" value={stats.knowledgeMissingRate ?? 0} suffix="%" /></Col>
      </Row>
      <Form layout="inline" className="admin-filter-row" onFinish={(values) => void loadQueue(values.status)}>
        <Form.Item name="status" label="状态" initialValue="PENDING">
          <Select
            style={{ width: 180 }}
            options={[
              { value: 'PENDING', label: '待审核' },
              { value: 'APPROVED', label: '已放行' },
              { value: 'REWRITTEN', label: '已改写' },
              { value: 'REJECTED', label: '已驳回' },
              { value: 'KNOWLEDGE_MISSING', label: '知识缺失' },
              { value: 'all', label: '全部' },
            ]}
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={loading}>查询</Button>
      </Form>
      <Table rowKey="traceId" columns={columns} dataSource={data} loading={loading} pagination={{ pageSize: 10 }} />
      <Drawer title={detail ? `审核 · ${detail.traceId}` : '审核'} open={Boolean(detail)} width={900} onClose={() => setDetail(null)}>
        {detail ? (
          <Space direction="vertical" size="large" className="admin-rag-detail">
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="问题">{detail.question}</Descriptions.Item>
              <Descriptions.Item label="审核原因">{detail.reviewReason || detail.lowConfidenceReason || '-'}</Descriptions.Item>
              <Descriptions.Item label="原回答">{detail.response?.answer || '-'}</Descriptions.Item>
            </Descriptions>
            <Form layout="vertical" form={reviewForm}>
              <Form.Item name="reviewedAnswer" label="审核后答案">
                <Input.TextArea rows={6} />
              </Form.Item>
              <Form.Item name="comment" label="审核备注">
                <Input.TextArea rows={3} />
              </Form.Item>
            </Form>
            <Space wrap>
              <Button type="primary" onClick={() => void submitReview('APPROVED')}>放行</Button>
              <Button onClick={() => void submitReview('REWRITTEN')}>保存改写</Button>
              <Button danger onClick={() => void submitReview('REJECTED')}>驳回</Button>
              <Button onClick={() => void submitReview('KNOWLEDGE_MISSING')}>标记知识缺失</Button>
            </Space>
            <Divider />
            {renderRetrievalTrace(detail.response?.retrievalTrace)}
          </Space>
        ) : null}
      </Drawer>
    </Card>
  )
}

function EvalPanel() {
  const [runs, setRuns] = useState<RagEvalRun[]>([])
  const [detail, setDetail] = useState<RagEvalRun | null>(null)
  const [loading, setLoading] = useState(false)
  const [promptVersions, setPromptVersions] = useState<RagPromptConfig[]>([])
  const [compareVersions, setCompareVersions] = useState<{ leftVersion?: string; rightVersion?: string }>({})
  const [compareResult, setCompareResult] = useState<RagPromptCompare | null>(null)

  async function loadRuns() {
    const response = await axios.get<RagEvalRun[]>('/api/admin/guide/rag-evals')
    setRuns(response.data)
  }

  async function loadPromptVersions() {
    const response = await axios.get<RagPromptConfig[]>('/api/admin/settings/rag-prompts')
    setPromptVersions(response.data)
  }

  async function runEval() {
    setLoading(true)
    try {
      const response = await axios.post<RagEvalRun>('/api/admin/guide/rag-evals/run')
      setDetail(response.data)
      await loadRuns()
      message.success(`评测完成，通过率 ${response.data.passRate}%`)
    } finally {
      setLoading(false)
    }
  }

  async function comparePrompts() {
    if (!compareVersions.leftVersion || !compareVersions.rightVersion) {
      message.warning('请选择两个 Prompt 版本')
      return
    }
    setLoading(true)
    try {
      const response = await axios.post<RagPromptCompare>('/api/admin/guide/rag-evals/compare-prompts', compareVersions)
      setCompareResult(response.data)
      await loadRuns()
      message.success(`对比完成，通过率变化 ${response.data.passRateDelta}%`)
    } finally {
      setLoading(false)
    }
  }

  async function openRun(id: number) {
    const response = await axios.get<RagEvalRun>(`/api/admin/guide/rag-evals/${id}`)
    setDetail(response.data)
  }

  useEffect(() => {
    void loadRuns()
    void loadPromptVersions()
  }, [])

  const runColumns: TableColumnsType<RagEvalRun> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: 'Prompt', dataIndex: 'promptVersion' },
    { title: '通过', render: (_, row) => `${row.passedCases}/${row.totalCases}` },
    { title: '通过率', dataIndex: 'passRate', render: (value: number) => `${value}%` },
    { title: '时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
    { title: '操作', render: (_, row) => <Button type="link" onClick={() => void openRun(row.id)}>详情</Button> },
  ]

  const caseColumns: TableColumnsType<RagEvalCase> = [
    { title: 'Case', dataIndex: 'caseId' },
    { title: '问题', dataIndex: 'question' },
    { title: '结果', dataIndex: 'passed', render: (passed: boolean) => <Tag color={passed ? 'green' : 'red'}>{passed ? '通过' : '失败'}</Tag> },
    { title: '失败原因', dataIndex: 'failureReason', render: (value?: string) => value || '-' },
    { title: 'TopScore', dataIndex: 'topScore', render: (value?: number) => value?.toFixed?.(4) ?? '-' },
    { title: 'Trace', dataIndex: 'traceId', render: (value?: string) => value || '-' },
  ]

  return (
    <Card title="RAG 评测报告" extra={<Button type="primary" loading={loading} onClick={() => void runEval()}>运行评测</Button>}>
      <Card size="small" title="Prompt 对比评测" className="admin-build-summary">
        <Space wrap>
          <Select
            placeholder="基准版本"
            style={{ width: 220 }}
            value={compareVersions.leftVersion}
            onChange={(leftVersion) => setCompareVersions((current) => ({ ...current, leftVersion }))}
            options={promptVersions.map((item) => ({ value: item.version, label: item.version }))}
          />
          <Select
            placeholder="对比版本"
            style={{ width: 220 }}
            value={compareVersions.rightVersion}
            onChange={(rightVersion) => setCompareVersions((current) => ({ ...current, rightVersion }))}
            options={promptVersions.map((item) => ({ value: item.version, label: item.version }))}
          />
          <Button loading={loading} onClick={() => void comparePrompts()}>开始对比</Button>
          {compareResult ? (
            <Tag color={compareResult.passRateDelta >= 0 ? 'green' : 'red'}>
              通过率变化 {compareResult.passRateDelta}% / 通过数变化 {compareResult.passedCasesDelta}
            </Tag>
          ) : null}
        </Space>
      </Card>
      <Table rowKey="id" columns={runColumns} dataSource={runs} pagination={{ pageSize: 8 }} />
      <Drawer title={detail ? `评测 #${detail.id}` : '评测详情'} open={Boolean(detail)} width={1000} onClose={() => setDetail(null)}>
        {detail ? (
          <Space direction="vertical" size="large" className="admin-rag-detail">
            <Descriptions bordered size="small" column={3}>
              <Descriptions.Item label="Prompt">{detail.promptVersion}</Descriptions.Item>
              <Descriptions.Item label="通过">{detail.passedCases}/{detail.totalCases}</Descriptions.Item>
              <Descriptions.Item label="通过率">{detail.passRate}%</Descriptions.Item>
            </Descriptions>
            <Table rowKey="caseId" columns={caseColumns} dataSource={detail.cases ?? []} pagination={false} />
          </Space>
        ) : null}
      </Drawer>
    </Card>
  )
}

function KnowledgeMissingPanel() {
  const [items, setItems] = useState<RagTraceSummary[]>([])
  const [loading, setLoading] = useState(false)

  async function loadItems() {
    setLoading(true)
    try {
      const response = await axios.get<RagMetrics>('/api/admin/guide/rag-metrics')
      setItems(response.data.knowledgeMissingTraces ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [])

  return (
    <Card title="知识缺失池" extra={<Button onClick={() => void loadItems()} loading={loading}>刷新</Button>}>
      <Table
        rowKey="traceId"
        loading={loading}
        dataSource={items}
        pagination={{ pageSize: 10 }}
        columns={[
          { title: '问题', dataIndex: 'question' },
          { title: '原因', dataIndex: 'answerPreview', ellipsis: true },
          { title: '状态', dataIndex: 'status', render: (value: string) => getRagStatusTag(value) },
          { title: '审核', dataIndex: 'reviewStatus', render: (value?: string) => value || '-' },
          { title: '时间', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString('zh-CN') },
        ]}
      />
    </Card>
  )
}

function renderPanel(activeKey: MenuKey) {
  switch (activeKey) {
    case 'knowledge':
      return <KnowledgePanel />
    case 'spots':
      return <SpotsPanel />
    case 'spot-category':
      return <SpotCategoryPage />
    case 'facility-list':
      return <FacilityListPage />
    case 'routes':
      return <RoutesPanel />
    case 'avatar':
      return <AvatarPanel />
    case 'settings':
      return <SettingsPanel />
    case 'travel-analytics':
      return <TravelAnalyticsPage />
    case 'feedback':
      return <FeedbackPanel />
    case 'qa':
      return <QaPanel />
    case 'review':
      return <ReviewPanel />
    case 'knowledge-missing':
      return <KnowledgeMissingPanel />
    case 'eval':
      return <EvalPanel />
    case 'dashboard':
    default:
      return <DashboardPanel />
  }
}

function LoginView({
  loading,
  error,
  username,
  password,
  setUsername,
  setPassword,
  onSubmit,
}: {
  loading: boolean
  error: string
  username: string
  password: string
  setUsername: (value: string) => void
  setPassword: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">DigitalHuman Admin</p>
        <h1>管理后台登录</h1>
        <p className="lead">
          这一版先完成比赛演示后台骨架，包括总览、知识库、景点、路线、数字人配置、反馈分析和问答查询。
        </p>
        <div className="account-list">
          <div>
            <span>管理员</span>
            <strong>admin / admin123</strong>
          </div>
          <div>
            <span>普通用户</span>
            <strong>user / user123</strong>
          </div>
        </div>
      </section>
      <section className="panel">
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            用户名
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          {error ? <p className="message error">{error}</p> : null}
        </form>
      </section>
    </main>
  )
}

function AdminLayout({ user, onLogout }: { user: LoginResult; onLogout: () => void }) {
  const [spotDrawerOpen, setSpotDrawerOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const activeKey = getMenuKeyFromPath(location.pathname)

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/admin') {
      navigate(ADMIN_HOME_PATH, { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <Layout className="admin-shell">
      <SpotDrawer
        open={spotDrawerOpen}
        onClose={() => setSpotDrawerOpen(false)}
        title="新增景点"
        actionText="发布景点"
        onAction={() => {
          message.success('发布成功')
          setSpotDrawerOpen(false)
        }}
      />
      <AdminSidebar
        activeKey={activeKey}
        displayName={user.displayName}
        role={user.role}
        onLogout={onLogout}
        onSelect={(key) => navigate(getPathForMenuKey(key as MenuKey))}
      />
      <Layout>
        <Content className={activeKey === 'travel-analytics' ? 'admin-content admin-content--fullscreen-table' : 'admin-content'}>
          {activeKey === 'facility-list'
            ? <FacilityListPage onAddFacility={() => setSpotDrawerOpen(true)} />
            : renderPanel(activeKey)}
        </Content>
      </Layout>
    </Layout>
  )
}

function App() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<LoginResult | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  useEffect(() => {
    document.body.classList.toggle('admin-page', Boolean(user))
    return () => {
      document.body.classList.remove('admin-page')
    }
  }, [user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post<LoginResult>('/api/auth/login', {
        username,
        password,
      })

      if (!['ADMIN', 'REVIEWER', 'KNOWLEDGE_ADMIN', 'OBSERVER'].includes(response.data.role)) {
        setError('当前入口仅允许管理员登录，请使用管理员账号。')
        setUser(null)
        return
      }

      saveUser(response.data)
      setUser(response.data)
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        setError(submitError.response?.data?.message ?? '登录失败，请检查后端服务和账号密码。')
      } else {
        setError('登录失败，请稍后重试。')
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await axios.delete('/api/auth/logout')
    } catch {
      // Ignore logout failures and clear local session anyway.
    } finally {
      clearUser()
      setUser(null)
    }
  }

  if (!user) {
    return (
      <LoginView
        loading={loading}
        error={error}
        username={username}
        password={password}
        setUsername={setUsername}
        setPassword={setPassword}
        onSubmit={handleSubmit}
      />
    )
  }

  return <AdminLayout user={user} onLogout={handleLogout} />
}

export default App

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`
  }
  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`
  }
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function normalizeBuildResponse(data: KnowledgeBuildResponseApi): KnowledgeBuildResult {
  return {
    filesSeen: data.filesSeen ?? data.files_seen ?? 0,
    filesIndexed: data.filesIndexed ?? data.files_indexed ?? 0,
    chunksIndexed: data.chunksIndexed ?? data.chunks_indexed ?? 0,
    collection: data.collection ?? '-',
    embeddingProvider: data.embeddingProvider ?? data.embedding_provider,
    embeddingModel: data.embeddingModel ?? data.embedding_model,
    builtAt: new Date().toISOString(),
  }
}

function selectedEmbeddingPayload(
  options: { value: string; provider: string; modelId: string }[],
  selectedValue?: string,
) {
  const selected = options.find((item) => item.value === selectedValue)
  return selected
    ? { embeddingProvider: selected.provider, embeddingModel: selected.modelId }
    : null
}
