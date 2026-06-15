import { Component, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from 'react'
import axios from 'axios'
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
  Select,
  Tabs,
  message,
  Modal,
  InputNumber,
  Switch,
  Space,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useLocation, useNavigate } from 'react-router-dom'
import AdminSidebar from '../components/AdminSidebar'
import { useDeferredMount } from '../hooks/useDeferredMount'
import ChatConfigPage from './settings/ChatConfigPage'
import EmbeddingConfigPage from './settings/EmbeddingConfigPage'
import ModelManualPage from './settings/ModelManualPage'
import MultimodalConfigPage from './settings/MultimodalConfigPage'
import VisionConfigPage from './settings/VisionConfigPage'
import VoiceConfigPage from './settings/VoiceConfigPage'
import SpotCategoryPage from './scenic/SpotCategoryPage'
import FacilityListPage from './scenic/FacilityListPage'
import TravelAnalyticsPage from './scenic/TravelAnalyticsPage'
import ScenicStructuredPage from './scenic/ScenicStructuredPage'
import VoiceScriptPage from './scenic/VoiceScriptPage'
import RouteManagementPage from './scenic/RouteManagementPage'
import ModelEmotionPage from './ModelEmotionPage'
import HomeConfigPage from './HomeConfigPage'
import AiModelManagementPage from './AiModelManagementPage'
import KnowledgeOpenApiPage from './KnowledgeOpenApiPage'
import type { LoginResult } from '../types/admin'

const { Content } = Layout

class AdminPanelErrorBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { errorMessage: string }
> {
  state = { errorMessage: '' }

  static getDerivedStateFromError(error: unknown) {
    return {
      errorMessage: error instanceof Error ? error.message : '页面渲染异常',
    }
  }

  componentDidUpdate(previousProps: { resetKey: string }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.errorMessage) {
      this.setState({ errorMessage: '' })
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Admin panel render failed', error, info)
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <Card title="页面加载异常">
          <Typography.Paragraph type="secondary">
            当前页面渲染失败，请刷新后重试。错误信息：{this.state.errorMessage}
          </Typography.Paragraph>
          <Button type="primary" onClick={() => window.location.reload()}>
            刷新页面
          </Button>
        </Card>
      )
    }

    return this.props.children
  }
}

type MenuKey =
  | 'dashboard'
  | 'home-config'
  | 'spots'
  | 'spot-category'
  | 'facility-list'
  | 'routes'
  | 'avatar'
  | 'model-emotion'
  | 'settings'
  | 'travel-analytics'
  | 'scenic-structured'
  | 'voice-scripts'
  | 'feedback'
  | 'qa'
  | 'ai-models'
  | 'knowledge'

const ADMIN_HOME_PATH = '/admin/dashboard'

const menuPathByKey: Record<MenuKey, string> = {
  dashboard: ADMIN_HOME_PATH,
  'home-config': '/admin/home-config',
  spots: '/admin/spots',
  'spot-category': '/admin/spots/categories',
  'facility-list': '/admin/spots/facilities',
  routes: '/admin/routes',
  avatar: '/admin/avatar',
  'model-emotion': '/admin/model-emotion',
  settings: '/admin/setting',
  'travel-analytics': '/admin/travel-analytics',
  'scenic-structured': '/admin/scenic-structured',
  'voice-scripts': '/admin/voice-scripts',
  feedback: '/admin/feedback',
  qa: '/admin/qa',
  'ai-models': '/admin/ai-models',
  knowledge: '/admin/knowledge',
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

type FeedbackRow = {
  key: string
  traceId?: string
  question: string
  helpful: string
  rating: string
  comment: string
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
}

type ProviderConfig = {
  provider: string
  baseUrl: string
  apiKey: string
  protocol: string
}

type AgentModelBindingItem = {
  agent: string
  category: ModelCategory
  provider: string
  model: string
  timeoutSeconds: number
  enabled: boolean
}

type AgentModelBindingPayload = {
  items: AgentModelBindingItem[]
}

type AgentCatalogItem = {
  name: string
  displayName?: string
  soul: string
  skill: string
  categoryHint?: ModelCategory
}

type AgentCatalogResponse = {
  agents: AgentCatalogItem[]
}

type AgentHealthTestResponse = {
  success: boolean
  agent: string
  message: string
  detail?: string
  provider?: string
  model?: string
  result?: string
}

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
]

const MODEL_OPTIONS_BY_CATEGORY_FIELD: Record<ModelCategory, keyof AdminModelCatalog> = {
  embedding: 'embeddingModels',
  speech: 'speechModels',
  vision: 'visionModels',
  chat: 'chatModels',
  multimodal: 'multimodalModels',
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

const feedbackColumns: TableColumnsType<FeedbackRow> = [
  { title: 'Trace', dataIndex: 'traceId', render: (value?: string) => value || '-' },
  { title: '问题', dataIndex: 'question' },
  { title: '帮助情况', dataIndex: 'helpful' },
  { title: '评分', dataIndex: 'rating' },
  { title: '意见', dataIndex: 'comment' },
]

function DashboardPanel() {
  return (
    <div className="admin-panel-grid">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="景点管理" value="运行中" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="路线配置" value="运行中" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="数字人配置" value="运行中" /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="AI 模型" value="可配置" /></Card></Col>
      </Row>
      <Card title="系统总览">
        <Typography.Paragraph>
          后台已移除本地知识上传、构建、向量检索、审核和评测链路。导览问答继续通过基础对话智能体调用已配置的大模型。
        </Typography.Paragraph>
      </Card>
    </div>
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
    <Card title="景点管理">
      <Table columns={spotColumns} dataSource={data} pagination={false} />
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

  useDeferredMount(() => {
    void loadConfig()
  })

  return (
    <div className="admin-panel-grid">
      <Card title="数字人展示配置" extra={<Tag color="blue">游客端生效</Tag>}>
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
            <Input.TextArea rows={4} />
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
    ? (isSoftSuccess ? '接口已经打通，模型也有响应。' : '模型接口调用成功，当前配置可继续使用。')
    : result.message
  const detail = result.success
    ? (isSoftSuccess ? '建议继续在真实业务场景里再测一轮。' : result.detail ?? '当前测试已通过。')
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
  const [activeSettingsTab, setActiveSettingsTab] = useState('embedding')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [voiceOptions, setVoiceOptions] = useState<{ value: string; label: string }[]>([])
  const [testingCategory, setTestingCategory] = useState<ModelCategory | null>(null)
  const [deletingModelOption, setDeletingModelOption] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Partial<Record<ModelCategory, ModelTestResponse>>>({})
  const [agentBindingLoading, setAgentBindingLoading] = useState(false)
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([])
  const [agentBindings, setAgentBindings] = useState<AgentModelBindingItem[]>([])
  const [agentCatalog, setAgentCatalog] = useState<AgentCatalogItem[]>([])
  const [testingAgent, setTestingAgent] = useState<string | null>(null)
  const [agentTestModalOpen, setAgentTestModalOpen] = useState(false)
  const [agentTestInput, setAgentTestInput] = useState<{ agent: string; task: string }>({ agent: '', task: '' })
  const [agentTestResult, setAgentTestResult] = useState<AgentHealthTestResponse | null>(null)
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
  const manualSpeechOptions = useMemo(
    () => catalog.speechModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.speechModels],
  )

  async function loadSettings() {
    setLoading(true)
    try {
      const [settingsResponse, catalogResponse, providerResponse, bindingsResponse, agentCatalogResponse] = await Promise.all([
        axios.get<AdminModelSettings>('/api/admin/settings/models'),
        axios.get<AdminModelCatalog>('/api/admin/settings/model-options'),
        axios.get<ProviderConfig[]>('/api/admin/settings/providers'),
        axios.get<AgentModelBindingPayload>('/api/admin/settings/agent-model-bindings'),
        axios.get<AgentCatalogResponse>('/api/admin/settings/agent-catalog'),
      ])
      form.setFieldsValue(settingsResponse.data)
      setCatalog(catalogResponse.data)
      setProviderConfigs(providerResponse.data)
      speechTestForm.setFieldsValue({ speechTestText: '您好，欢迎来到灵山胜境，这是一段语音测试。' })

      const defaultByAgent = new Map((agentCatalogResponse.data.agents ?? []).map((item) => [
        item.name,
        {
          agent: item.name,
          category: item.categoryHint ?? 'chat',
          provider: '',
          model: '',
          timeoutSeconds: 90,
          enabled: false,
        } as AgentModelBindingItem,
      ]))
      for (const item of bindingsResponse.data.items ?? []) {
        defaultByAgent.set(item.agent, item)
      }
      setAgentCatalog(agentCatalogResponse.data.agents ?? [])
      setAgentBindings(Array.from(defaultByAgent.values()))
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '模型设置加载失败，请检查后端服务。'
        : '模型设置加载失败，请稍后重试。'
      message.error(description)
    } finally {
      setLoading(false)
    }
  }

  useDeferredMount(() => {
    void loadSettings()
  })

  useEffect(() => {
    async function loadVoices() {
      try {
        const response = await axios.get<TtsVoicesResponse>('/api/tts/voices')
        setVoiceOptions((response.data.voices ?? []).map((voice) => ({ value: voice, label: voice })))
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

      setTestResults((current) => ({ ...current, [category]: nextResult }))
      message.success(response.data.message)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '模型测试失败，请检查服务配置。'
        : '模型测试失败，请稍后重试。'
      setTestResults((current) => ({
        ...current,
        [category]: { success: false, provider: '', category, modelId, message: description },
      }))
      message.error(description)
    } finally {
      setTestingCategory(null)
    }
  }

  async function saveAgentBindings() {
    setAgentBindingLoading(true)
    try {
      const response = await axios.put<AgentModelBindingPayload>('/api/admin/settings/agent-model-bindings', { items: agentBindings })
      setAgentBindings(response.data.items)
      message.success('智能体模型编排已保存')
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '保存智能体模型编排失败，请检查后端服务。'
        : '保存智能体模型编排失败，请稍后重试。'
      message.error(description)
    } finally {
      setAgentBindingLoading(false)
    }
  }

  const updateBinding = (agent: string, patch: Partial<AgentModelBindingItem>) => {
    setAgentBindings((current) => current.map((item) => (item.agent === agent ? { ...item, ...patch } : item)))
  }

  const openAgentTestModal = (agent: string) => {
    setAgentTestInput({ agent, task: `请以${agent}身份执行一次简短测试，并返回结构化结果。` })
    setAgentTestResult(null)
    setAgentTestModalOpen(true)
  }

  async function testAgent(agent: string, task: string) {
    setTestingAgent(agent)
    try {
      const response = await axios.post<AgentHealthTestResponse>('/api/admin/settings/agent-test', { agent, task })
      setAgentTestResult(response.data)
      if (response.data.success) {
        message.success(`${response.data.message}：${agent}`)
      } else {
        message.warning(`${response.data.message}：${response.data.detail ?? ''}`)
      }
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '智能体测试失败'
        : '智能体测试失败'
      message.error(description)
    } finally {
      setTestingAgent(null)
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
          options={manualSpeechOptions.length ? manualSpeechOptions : voiceOptions}
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
      children: (
        <ModelManualPage
          onCatalogChange={(nextCatalog) => setCatalog(nextCatalog)}
          onProviderConfigsChange={(nextProviders) => setProviderConfigs(nextProviders)}
        />
      ),
    },
    {
      key: 'agents',
      label: '智能体编排',
      children: (
        <Card
          size="small"
          title="智能体模型编排"
          extra={<Button type="primary" loading={agentBindingLoading} onClick={() => void saveAgentBindings()}>保存智能体编排</Button>}
        >
          <Table
            rowKey="agent"
            pagination={false}
            dataSource={agentBindings}
            columns={[
              {
                title: '智能体',
                dataIndex: 'agent',
                render: (value: string) => {
                  const meta = agentCatalog.find((item) => item.name === value)
                  return (
                    <Space direction="vertical" size={2}>
                      <Tag color="blue">{meta?.displayName || value}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{value}</Typography.Text>
                    </Space>
                  )
                },
              },
              {
                title: '模型分类',
                dataIndex: 'category',
                render: (value: ModelCategory, row: AgentModelBindingItem) => (
                  <Select
                    value={value}
                    options={[
                      { value: 'chat', label: '对话模型' },
                      { value: 'multimodal', label: '多模态模型' },
                      { value: 'vision', label: '视觉模型' },
                      { value: 'embedding', label: '嵌入模型' },
                      { value: 'speech', label: '语音音色' },
                    ]}
                    style={{ width: 160 }}
                    onChange={(next) => updateBinding(row.agent, { category: next })}
                  />
                ),
              },
              {
                title: 'Provider',
                dataIndex: 'provider',
                render: (value: string, row: AgentModelBindingItem) => (
                  <Select
                    value={value}
                    options={providerConfigs.map((item) => ({ value: item.provider, label: item.provider }))}
                    style={{ width: 160 }}
                    onChange={(next) => updateBinding(row.agent, { provider: next })}
                  />
                ),
              },
              {
                title: '模型 ID',
                dataIndex: 'model',
                render: (value: string, row: AgentModelBindingItem) => (
                  <Select
                    value={value}
                    options={(catalog[MODEL_OPTIONS_BY_CATEGORY_FIELD[row.category]] ?? [])
                      .filter((item) => item.provider === row.provider)
                      .map((item) => ({ value: item.modelId, label: item.modelId }))}
                    showSearch
                    optionFilterProp="label"
                    onChange={(next) => updateBinding(row.agent, { model: next })}
                  />
                ),
              },
              {
                title: '超时秒数',
                dataIndex: 'timeoutSeconds',
                width: 140,
                render: (value: number, row: AgentModelBindingItem) => (
                  <InputNumber
                    value={value}
                    min={1}
                    max={600}
                    style={{ width: '100%' }}
                    onChange={(next) => updateBinding(row.agent, { timeoutSeconds: Number(next || 90) })}
                  />
                ),
              },
              {
                title: '启用',
                dataIndex: 'enabled',
                width: 100,
                render: (value: boolean, row: AgentModelBindingItem) => (
                  <Switch checked={value} onChange={(next) => updateBinding(row.agent, { enabled: next })} />
                ),
              },
              {
                title: '测试',
                width: 100,
                render: (_, row: AgentModelBindingItem) => (
                  <Button size="small" loading={testingAgent === row.agent} onClick={() => openAgentTestModal(row.agent)}>
                    测试
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      ),
    },
  ]

  return (
    <div className="admin-panel-grid">
      <Card title="系统设置" extra={<Tag color="blue">左下角入口</Tag>} className="admin-settings-card">
        <Tabs activeKey={activeSettingsTab} onChange={setActiveSettingsTab} items={settingsTabs} />
      </Card>
      <Modal
        title="智能体任务测试"
        open={agentTestModalOpen}
        onCancel={() => setAgentTestModalOpen(false)}
        onOk={() => void testAgent(agentTestInput.agent, agentTestInput.task)}
        confirmLoading={testingAgent === agentTestInput.agent}
        okText="执行测试"
      >
        <Form layout="vertical">
          <Form.Item label="智能体">
            <Input value={agentTestInput.agent} disabled />
          </Form.Item>
          <Form.Item label="测试任务">
            <Input.TextArea
              rows={5}
              value={agentTestInput.task}
              onChange={(event) => setAgentTestInput((current) => ({ ...current, task: event.target.value }))}
            />
          </Form.Item>
          {agentTestResult ? (
            <Card size="small" title={agentTestResult.success ? '测试成功' : '测试失败'}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text>消息：{agentTestResult.message}</Typography.Text>
                {agentTestResult.provider ? <Typography.Text>Provider：{agentTestResult.provider}</Typography.Text> : null}
                {agentTestResult.model ? <Typography.Text>模型：{agentTestResult.model}</Typography.Text> : null}
                {agentTestResult.detail ? <Typography.Text type="secondary">详情：{agentTestResult.detail}</Typography.Text> : null}
                {agentTestResult.result ? <Input.TextArea value={agentTestResult.result} rows={8} readOnly /> : null}
              </Space>
            </Card>
          ) : null}
        </Form>
      </Modal>
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

function QaPanel() {
  return (
    <Card title="问答记录查询">
      <Typography.Paragraph>
        本地问答 Trace 已移除。游客问答记录仍保存在会话消息中，后续可按第三方知识 API 返回格式重新接入查询视图。
      </Typography.Paragraph>
    </Card>
  )
}

function renderPanel(activeKey: MenuKey) {
  switch (activeKey) {
    case 'home-config':
      return <HomeConfigPage />
    case 'spots':
      return <SpotsPanel />
    case 'spot-category':
      return <SpotCategoryPage />
    case 'facility-list':
      return <FacilityListPage />
    case 'routes':
      return <RouteManagementPage />
    case 'avatar':
      return <AvatarPanel />
    case 'model-emotion':
      return <ModelEmotionPage />
    case 'settings':
      return <SettingsPanel />
    case 'travel-analytics':
      return <TravelAnalyticsPage />
    case 'scenic-structured':
      return <ScenicStructuredPage />
    case 'voice-scripts':
      return <VoiceScriptPage />
    case 'feedback':
      return <FeedbackPanel />
    case 'qa':
      return <QaPanel />
    case 'ai-models':
      return <AiModelManagementPage />
    case 'knowledge':
      return <KnowledgeOpenApiPage />
    case 'dashboard':
    default:
      return <DashboardPanel />
  }
}

export function AdminLayout({ user, onLogout }: { user: LoginResult; onLogout: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeKey = getMenuKeyFromPath(location.pathname)

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/admin') {
      navigate(ADMIN_HOME_PATH, { replace: true })
    }
  }, [location.pathname, navigate])

  return (
    <Layout className="admin-shell notranslate" translate="no">
      <AdminSidebar
        activeKey={activeKey}
        displayName={user.displayName}
        role={user.role}
        onLogout={onLogout}
        onSelect={(key) => navigate(getPathForMenuKey(key as MenuKey))}
      />
      <Layout>
        <Content className="admin-content">
          <AdminPanelErrorBoundary resetKey={activeKey}>
            {renderPanel(activeKey)}
          </AdminPanelErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  )
}

export default AdminLayout
