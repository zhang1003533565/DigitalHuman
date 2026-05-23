import { type FormEvent, type JSX, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  BarChartOutlined,
  BookOutlined,
  BuildOutlined,
  CommentOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Button, Card, Form, Input, Table, Tag, Statistic, Row, Col, Upload, Select, AutoComplete, Tabs, message } from 'antd'
import type { UploadProps } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import SpotAddPage from './pages/SpotAddPage'
import SpotCategoryPage from './pages/SpotCategoryPage'
import FacilityListPage from './pages/FacilityListPage'
import './App.css'

const { Header, Sider, Content } = Layout
const SESSION_STORAGE_KEY = 'digitalhuman.admin.user'

type LoginResult = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
  token: string
}

type MenuKey =
  | 'dashboard'
  | 'knowledge'
  | 'spots'
  | 'spot-add'
  | 'spot-category'
  | 'facility-list'
  | 'routes'
  | 'avatar'
  | 'settings'
  | 'feedback'
  | 'qa'

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
  question: string
  helpful: string
  rating: string
  comment: string
}

type KnowledgeDocumentRow = {
  key: string
  fileName: string
  sizeText: string
  updatedAt: string
  supported: boolean
}

type KnowledgeBuildResult = {
  filesSeen: number
  filesIndexed: number
  chunksIndexed: number
  collection: string
  builtAt: string
}

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
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

type AddModelOptionForm = {
  category: ModelCategory
  provider: string
  modelId: string
}

type ModelTestResponse = {
  success: boolean
  provider: string
  category: ModelCategory
  modelId: string
  message: string
  detail?: string
}

type ModelCatalogRow = {
  key: string
  category: ModelCategory
  provider: string
  modelId: string
  selected: boolean
}

type ProviderConfig = {
  provider: string
  baseUrl: string
  apiKey: string
  protocol: string
}

type ProviderConfigForm = {
  provider: string
  baseUrl: string
  apiKey: string
  protocol: string
}

type ProviderDoc = {
  provider: string
  fileName: string
  markdown: string
}

type TtsVoicesResponse = {
  voices: string[]
}

const PROVIDER_OPTIONS = [
  { value: 'DeepSeek', label: 'DeepSeek' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Qwen', label: 'Qwen' },
  { value: 'Azure', label: 'Azure' },
  { value: 'Google', label: 'Google' },
]

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; protocol: string }> = {
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    protocol: 'openai_compatible',
  },
  OpenAI: {
    baseUrl: 'https://api.openai.com/v1',
    protocol: 'openai_compatible',
  },
  Qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    protocol: 'openai_compatible',
  },
  Azure: {
    baseUrl: '',
    protocol: 'openai_compatible',
  },
  Google: {
    baseUrl: '',
    protocol: 'openai_compatible',
  },
}

const MODEL_CATEGORY_OPTIONS = [
  { value: 'embedding', label: '嵌入模型' },
  { value: 'speech', label: '语音模型' },
  { value: 'vision', label: '视觉模型' },
  { value: 'chat', label: '对话模型' },
  { value: 'multimodal', label: '多模态模型' },
] as const

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
      <Tag color={supported ? 'green' : 'red'}>{supported ? '可用' : '格式不支持'}</Tag>
    ),
  },
]

const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <BarChartOutlined />, label: '数据总览' },
  { key: 'knowledge', icon: <BookOutlined />, label: '知识库管理' },
  {
    key: 'spots',
    icon: <EnvironmentOutlined />,
    label: '景点管理',
    children: [
      { key: 'spot-add', label: '新增景点' },
      { key: 'spot-category', label: '景点分类' },
      { key: 'facility-list', label: '全部设施' },
    ],
  },
  { key: 'routes', icon: <NodeIndexOutlined />, label: '路线管理' },
  { key: 'avatar', icon: <RobotOutlined />, label: '数字人配置' },
  { key: 'feedback', icon: <CommentOutlined />, label: '游客反馈分析' },
  { key: 'qa', icon: <SearchOutlined />, label: '问答记录查询' },
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
  return (
    <div className="admin-panel-grid">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="今日服务人次" value={128} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="本周服务人次" value={986} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="负面反馈占比" value={12.4} suffix="%" /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="热门问题 Top3">
            <ul className="admin-list">
              <li>灵山大佛有什么历史？</li>
              <li>亲子路线怎么安排？</li>
              <li>拈花湾晚上适合去吗？</li>
            </ul>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="高频景点关注排行">
            <ul className="admin-list">
              <li>灵山大佛</li>
              <li>九龙灌浴</li>
              <li>拈花塔</li>
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

  async function loadDocuments() {
    const response = await axios.get('/api/admin/knowledge/documents')
    setDocuments(
      response.data.map((item: { fileName: string; sizeBytes: number; updatedAt: string; supported: boolean }) => ({
        key: `${item.fileName}-${item.updatedAt}`,
        fileName: item.fileName,
        sizeText: formatBytes(item.sizeBytes),
        updatedAt: new Date(item.updatedAt).toLocaleString('zh-CN'),
        supported: item.supported,
      })),
    )
  }

  async function buildKnowledgeBase(recreateCollection: boolean) {
    setBuilding(true)
    try {
      const response = await axios.post('/api/admin/knowledge/build', {
        recreateCollection,
      })
      const result: KnowledgeBuildResult = {
        filesSeen: response.data.filesSeen,
        filesIndexed: response.data.filesIndexed,
        chunksIndexed: response.data.chunksIndexed,
        collection: response.data.collection,
        builtAt: new Date().toISOString(),
      }
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

  useEffect(() => {
    void loadDocuments()
  }, [])

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
        message.success(`上传成功，文件 ${response.data.fileName} 已加入待构建列表`)
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

  return (
    <Card
      title="知识库管理"
      extra={(
        <div className="admin-action-row">
          <Upload {...uploadProps}>
            <Button type="primary" loading={uploading}>上传文件</Button>
          </Upload>
          <Button
            icon={<BuildOutlined />}
            loading={building}
            onClick={() => void buildKnowledgeBase(false)}
          >
            开始构建
          </Button>
          <Button
            danger
            loading={building}
            onClick={() => void buildKnowledgeBase(true)}
          >
            全量重建
          </Button>
        </div>
      )}
    >
      <div className="admin-form-grid">
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
            <Card size="small">
              <Statistic title="待构建文件数" value={documents.length} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="上次扫描文件数" value={lastBuildResult?.filesSeen ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="上次入库文件数" value={lastBuildResult?.filesIndexed ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="上次知识块数" value={lastBuildResult?.chunksIndexed ?? 0} />
            </Card>
          </Col>
        </Row>
        {lastBuildResult ? (
          <Card size="small" className="admin-build-summary">
            最近一次构建写入集合 `{lastBuildResult.collection}`，共处理 {lastBuildResult.filesIndexed} 个文件，生成 {lastBuildResult.chunksIndexed} 个知识块。
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
          columns={knowledgeColumns}
          dataSource={documents}
          pagination={false}
          locale={{ emptyText: '暂无已上传知识文件，请先上传景区资料。' }}
        />
      </div>
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
  return (
    <div className="admin-panel-grid">
      <Card
        title="数字人基础配置"
        extra={<Tag color="blue">业务配置</Tag>}
      >
        <div className="admin-form-grid">
          <Card size="small" className="admin-build-summary">
            当前页只保留数字人的业务侧配置，比如欢迎词、讲解风格、默认角色和播报策略。
          </Card>
          <Form layout="vertical">
            <Form.Item label="默认欢迎词">
              <Input.TextArea
                rows={4}
                placeholder="例如：您好，欢迎来到灵山胜境，我可以为您介绍景点、路线和活动安排。"
              />
            </Form.Item>
            <Form.Item label="讲解风格">
              <Select
                placeholder="请选择讲解风格"
                options={[
                  { value: 'friendly', label: '亲切讲解' },
                  { value: 'professional', label: '专业导览' },
                  { value: 'family', label: '亲子互动' },
                ]}
              />
            </Form.Item>
            <Form.Item label="默认播报策略">
              <Select
                placeholder="请选择播报策略"
                options={[
                  { value: 'standard', label: '标准播报' },
                  { value: 'brief', label: '简洁播报' },
                  { value: 'storytelling', label: '故事化播报' },
                ]}
              />
            </Form.Item>
            <div className="admin-action-row">
              <Button type="primary">保存数字人配置</Button>
            </div>
          </Form>
        </div>
      </Card>
      <Card title="配置说明">
        <ul className="admin-list">
          <li>模型能力配置已统一迁移到左下角“设置”。</li>
          <li>这里建议只放数字人角色、话术、动作策略等业务参数。</li>
          <li>后续如果接真实接口，可以直接沿用当前表单结构。</li>
        </ul>
      </Card>
    </div>
  )
}

function SettingsPanel() {
  const [form] = Form.useForm<AdminModelSettings>()
  const [addOptionForm] = Form.useForm<AddModelOptionForm>()
  const [providerForm] = Form.useForm<ProviderConfigForm>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingOption, setAddingOption] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null)
  const [providerDocSelection, setProviderDocSelection] = useState('DeepSeek')
  const [providerDoc, setProviderDoc] = useState<ProviderDoc | null>(null)
  const [providerDocLoading, setProviderDocLoading] = useState(false)
  const [voiceOptions, setVoiceOptions] = useState<{ value: string; label: string }[]>([])
  const [testingCategory, setTestingCategory] = useState<ModelCategory | null>(null)
  const [testingRowKey, setTestingRowKey] = useState<string | null>(null)
  const [selectingRowKey, setSelectingRowKey] = useState<string | null>(null)
  const [deletingRowKey, setDeletingRowKey] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Partial<Record<ModelCategory, ModelTestResponse>>>({})
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([])
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
      const providerResponse = await axios.get<ProviderConfig[]>('/api/admin/settings/providers')
      form.setFieldsValue(settingsResponse.data)
      setCatalog(catalogResponse.data)
      setProviderConfigs(providerResponse.data)
      addOptionForm.setFieldsValue({
        category: 'multimodal',
        provider: providerResponse.data[0]?.provider ?? '',
        modelId: '',
      })
      providerForm.setFieldsValue({
        provider: '',
        baseUrl: '',
        apiKey: '',
        protocol: 'openai_compatible',
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
  }, [addOptionForm, form])

  useEffect(() => {
    async function loadProviderDoc() {
      setProviderDocLoading(true)
      try {
        const response = await axios.get<ProviderDoc>(`/api/admin/settings/provider-docs/${providerDocSelection}`)
        setProviderDoc(response.data)
      } catch (error) {
        const description = axios.isAxiosError(error)
          ? error.response?.data?.message ?? '读取模型说明文档失败。'
          : '读取模型说明文档失败。'
        message.error(description)
        setProviderDoc(null)
      } finally {
        setProviderDocLoading(false)
      }
    }

    void loadProviderDoc()
  }, [providerDocSelection])

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

  const catalogRows = useMemo<ModelCatalogRow[]>(() => {
    const currentValues = form.getFieldsValue()
    const rows: ModelCatalogRow[] = []
    const pushRows = (items: AdminModelOption[], category: ModelCategory, selectedModelId: string | undefined) => {
      items.forEach((item) => {
        rows.push({
          key: `${category}:${item.provider}:${item.modelId}`,
          category,
          provider: item.provider,
          modelId: item.modelId,
          selected: item.modelId === selectedModelId,
        })
      })
    }

    pushRows(catalog.embeddingModels, 'embedding', currentValues.embeddingModel)
    pushRows(catalog.speechModels, 'speech', currentValues.speechModel)
    pushRows(catalog.visionModels, 'vision', currentValues.visionModel)
    pushRows(catalog.chatModels, 'chat', currentValues.chatModel)
    pushRows(catalog.multimodalModels, 'multimodal', currentValues.multimodalModel)
    return rows
  }, [catalog, form])

  const handleSave = async (values: AdminModelSettings) => {
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

  const handleAddOption = async (values: AddModelOptionForm) => {
    setAddingOption(true)
    try {
      const response = await axios.post<AdminModelCatalog>('/api/admin/settings/model-options', values)
      setCatalog(response.data)
      message.success(`模型 ${values.modelId} 已加入候选列表`)
      addOptionForm.setFieldsValue({
        ...values,
        modelId: '',
      })
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '新增模型失败，请检查后端服务。'
        : '新增模型失败，请稍后重试。'
      message.error(description)
    } finally {
      setAddingOption(false)
    }
  }

  const handleSaveProvider = async (values: ProviderConfigForm) => {
    setSavingProvider(true)
    try {
      const response = await axios.put<ProviderConfig>('/api/admin/settings/providers', values)
      setProviderConfigs((current) => {
        const next = current.filter((item) => item.provider !== response.data.provider)
        return [...next, response.data].sort((left, right) => left.provider.localeCompare(right.provider))
      })
      providerForm.setFieldsValue({
        provider: '',
        baseUrl: '',
        apiKey: '',
        protocol: 'openai_compatible',
      })
      if (!addOptionForm.getFieldValue('provider')) {
        addOptionForm.setFieldValue('provider', response.data.provider)
      }
      message.success(`已保存提供方 ${response.data.provider}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '保存模型提供方失败，请检查后端服务。'
        : '保存模型提供方失败，请稍后重试。'
      message.error(description)
    } finally {
      setSavingProvider(false)
    }
  }

  const handleProviderDraftChange = (provider: string) => {
    const preset = PROVIDER_DEFAULTS[provider]
    if (!preset) {
      providerForm.setFieldValue('provider', provider)
      return
    }

    providerForm.setFieldsValue({
      provider,
      baseUrl: preset.baseUrl,
      protocol: preset.protocol,
      apiKey: providerForm.getFieldValue('apiKey') ?? '',
    })
  }

  const handleDeleteProvider = async (provider: string) => {
    setDeletingProvider(provider)
    try {
      await axios.post('/api/admin/settings/providers/delete', {
        provider,
      })
      setProviderConfigs((current) => current.filter((item) => item.provider !== provider))
      if (addOptionForm.getFieldValue('provider') === provider) {
        addOptionForm.setFieldValue('provider', '')
      }
      message.success(`已删除提供方 ${provider}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '删除模型提供方失败，请检查后端服务。'
        : '删除模型提供方失败，请稍后重试。'
      message.error(description)
    } finally {
      setDeletingProvider(null)
    }
  }

  const handleEditProvider = (providerConfig: ProviderConfig) => {
    providerForm.setFieldsValue({
      provider: providerConfig.provider,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      protocol: providerConfig.protocol,
    })
    message.info(`已载入 ${providerConfig.provider} 配置，可直接修改后保存`)
  }

  const fieldNameByCategory: Record<ModelCategory, keyof AdminModelSettings> = {
    embedding: 'embeddingModel',
    speech: 'speechModel',
    vision: 'visionModel',
    chat: 'chatModel',
    multimodal: 'multimodalModel',
  }

  const handleTestModel = async (category: ModelCategory) => {
    const fieldName = fieldNameByCategory[category]
    const values = await form.validateFields([fieldName])
    const modelId = values[fieldName] as string
    setTestingCategory(category)
    try {
      const response = await axios.post<ModelTestResponse>('/api/admin/settings/model-test', {
        category,
        modelId,
      })
      setTestResults((current) => ({
        ...current,
        [category]: response.data,
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

  const handleTestModelRow = async (row: ModelCatalogRow) => {
    setTestingRowKey(row.key)
    try {
      const response = await axios.post<ModelTestResponse>('/api/admin/settings/model-test', {
        category: row.category,
        modelId: row.modelId,
      })
      setTestResults((current) => ({
        ...current,
        [row.category]: response.data,
      }))
      message.success(response.data.message)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '模型测试失败，请检查服务配置。'
        : '模型测试失败，请稍后重试。'
      message.error(description)
    } finally {
      setTestingRowKey(null)
    }
  }

  const handleSelectModelRow = async (row: ModelCatalogRow) => {
    setSelectingRowKey(row.key)
    try {
      const response = await axios.put<AdminModelSettings>('/api/admin/settings/model-options/select', {
        category: row.category,
        provider: row.provider,
        modelId: row.modelId,
      })
      form.setFieldsValue(response.data)
      message.success(`已切换到模型 ${row.modelId}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '设置当前模型失败，请检查后端服务。'
        : '设置当前模型失败，请稍后重试。'
      message.error(description)
    } finally {
      setSelectingRowKey(null)
    }
  }

  const handleDeleteModelRow = async (row: ModelCatalogRow) => {
    setDeletingRowKey(row.key)
    try {
      const response = await axios.post<AdminModelCatalog>('/api/admin/settings/model-options/delete', {
        category: row.category,
        provider: row.provider,
        modelId: row.modelId,
      })
      setCatalog(response.data)
      if (row.selected) {
        await loadSettings()
      }
      message.success(`已删除模型 ${row.modelId}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '删除模型失败，请检查后端服务。'
        : '删除模型失败，请稍后重试。'
      message.error(description)
    } finally {
      setDeletingRowKey(null)
    }
  }

  const catalogColumns: TableColumnsType<ModelCatalogRow> = [
    {
      title: '分类',
      dataIndex: 'category',
      render: (value: ModelCategory) => MODEL_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value,
    },
    { title: '提供方', dataIndex: 'provider' },
    { title: '模型 ID', dataIndex: 'modelId' },
    {
      title: '状态',
      dataIndex: 'selected',
      render: (selected: boolean) => (
        <Tag color={selected ? 'green' : 'default'}>{selected ? '当前使用' : '候选'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, row) => (
        <div className="admin-action-row">
          <Button size="small" onClick={() => void handleTestModelRow(row)} loading={testingRowKey === row.key}>
            测试
          </Button>
          <Button size="small" type="primary" ghost onClick={() => void handleSelectModelRow(row)} loading={selectingRowKey === row.key}>
            设为当前
          </Button>
          <Button size="small" danger onClick={() => void handleDeleteModelRow(row)} loading={deletingRowKey === row.key}>
            删除
          </Button>
        </div>
      ),
    },
  ]

  const providerColumns: TableColumnsType<ProviderConfig> = [
    { title: '提供方', dataIndex: 'provider' },
    { title: '协议', dataIndex: 'protocol' },
    { title: 'Base URL', dataIndex: 'baseUrl' },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      render: (value: string) => (value ? `***${value.slice(-4)}` : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, row) => (
        <div className="admin-action-row">
          <Button
            size="small"
            onClick={() => handleEditProvider(row)}
          >
            编辑
          </Button>
          <Button
            size="small"
            danger
            onClick={() => void handleDeleteProvider(row.provider)}
            loading={deletingProvider === row.provider}
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

  const renderMarkdown = (markdown: string) => {
    const lines = markdown.split('\n')
    const elements: JSX.Element[] = []
    let listItems: string[] = []
    let paragraphLines: string[] = []

    const flushList = () => {
      if (!listItems.length) {
        return
      }
      elements.push(
        <ul className="admin-list admin-markdown-list" key={`list-${elements.length}`}>
          {listItems.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>,
      )
      listItems = []
    }

    const flushParagraph = () => {
      if (!paragraphLines.length) {
        return
      }
      elements.push(
        <p className="admin-markdown-paragraph" key={`p-${elements.length}`}>
          {paragraphLines.join(' ')}
        </p>,
      )
      paragraphLines = []
    }

    lines.forEach((rawLine) => {
      const line = rawLine.trim()
      if (!line) {
        flushList()
        flushParagraph()
        return
      }
      if (line.startsWith('# ')) {
        flushList()
        flushParagraph()
        elements.push(<h2 className="admin-markdown-h2" key={`h2-${elements.length}`}>{line.slice(2)}</h2>)
        return
      }
      if (line.startsWith('## ')) {
        flushList()
        flushParagraph()
        elements.push(<h3 className="admin-markdown-h3" key={`h3-${elements.length}`}>{line.slice(3)}</h3>)
        return
      }
      if (line.startsWith('### ')) {
        flushList()
        flushParagraph()
        elements.push(<h4 className="admin-markdown-h4" key={`h4-${elements.length}`}>{line.slice(4)}</h4>)
        return
      }
      if (line.startsWith('- ')) {
        flushParagraph()
        listItems.push(line.slice(2))
        return
      }
      paragraphLines.push(line)
    })

    flushList()
    flushParagraph()
    return elements
  }

  const renderActions = (category: ModelCategory) => (
    <div className="admin-action-row">
      <Button type="primary" htmlType="submit" loading={saving}>
        保存设置
      </Button>
      <Button onClick={() => void handleTestModel(category)} loading={testingCategory === category}>
        测试当前模型
      </Button>
      <Button onClick={() => form.resetFields()} disabled={saving || loading}>
        重置表单
      </Button>
    </div>
  )

  const renderTestResult = (category: ModelCategory) => {
    const result = testResults[category]
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
        </div>
      </Card>
    )
  }

  const renderTabLabel = (category: ModelCategory, label: string) => {
    const result = testResults[category]
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

  const modelSettingTabItems = [
    {
      key: 'embedding',
      label: renderTabLabel('embedding', '嵌入模型'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="嵌入模型"
            name="embeddingModel"
            rules={[{ required: true, message: '请输入嵌入模型' }]}
            extra="用于知识库分块向量化与相似度检索。"
          >
            <AutoComplete options={embeddingOptions}>
              <Input placeholder="例如：BAAI/bge-m3" />
            </AutoComplete>
          </Form.Item>
          {renderActions('embedding')}
          {renderTestResult('embedding')}
        </Form>
      ),
    },
    {
      key: 'speech',
      label: renderTabLabel('speech', '语音模型'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="语音模型"
            name="speechModel"
            rules={[{ required: true, message: '请输入语音模型' }]}
            extra="用于数字人播报和文本转语音，当前会直接展示本地 edge-tts 支持的语音列表。"
          >
            <AutoComplete options={voiceOptions}>
              <Input placeholder="例如：zh-CN-XiaoxiaoNeural" />
            </AutoComplete>
          </Form.Item>
          {renderActions('speech')}
          {renderTestResult('speech')}
        </Form>
      ),
    },
    {
      key: 'vision',
      label: renderTabLabel('vision', '视觉模型'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="视觉模型"
            name="visionModel"
            rules={[{ required: true, message: '请输入视觉模型' }]}
            extra="用于图片理解、景区识别和视觉问答。"
          >
            <AutoComplete options={visionOptions}>
              <Input placeholder="例如：Qwen/Qwen2.5-VL-7B-Instruct" />
            </AutoComplete>
          </Form.Item>
          {renderActions('vision')}
          {renderTestResult('vision')}
        </Form>
      ),
    },
    {
      key: 'chat',
      label: renderTabLabel('chat', '对话模型'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="对话模型"
            name="chatModel"
            rules={[{ required: true, message: '请输入对话模型' }]}
            extra="用于纯文本对话、问答、推理等场景。"
          >
            <AutoComplete options={chatOptions}>
              <Input placeholder="例如：deepseek-v4-flash / gpt-4.1 / qwen-max" />
            </AutoComplete>
          </Form.Item>
          {renderActions('chat')}
          {renderTestResult('chat')}
        </Form>
      ),
    },
    {
      key: 'multimodal',
      label: renderTabLabel('multimodal', '多模态模型'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="多模态模型"
            name="multimodalModel"
            rules={[{ required: true, message: '请输入多模态模型' }]}
            extra="用于图文联合理解、图片问答、视觉推理等多模态场景。"
          >
            <AutoComplete options={multimodalOptions}>
              <Input placeholder="例如：gpt-4o / Qwen/Qwen2.5-VL-7B-Instruct" />
            </AutoComplete>
          </Form.Item>
          {renderActions('multimodal')}
          {renderTestResult('multimodal')}
        </Form>
      ),
    },
  ]

  return (
    <div className="admin-panel-grid">
      <Card
        title="系统设置"
        extra={<Tag color="blue">左下角入口</Tag>}
        className="admin-settings-card"
      >
        <Tabs
          defaultActiveKey="embedding"
          items={[
            ...modelSettingTabItems,
            {
              key: 'model-catalog',
              label: '手动维护',
              children: (
                <div className="admin-form-grid">
                  <Card size="small" className="admin-build-summary">
                    模型列表改为手动维护。按分类逐个添加模型提供方和模型 ID，更适合你当前一条一条配置、逐步扩展 provider 能力文件的方式。
                  </Card>
                  <Card size="small" title="模型能力与支持模型" className="admin-build-summary">
                    <div className="admin-provider-docs">
                      <div className="admin-provider-docs__toolbar">
                        <Select
                          value={providerDocSelection}
                          options={[
                            { value: 'DeepSeek', label: 'DeepSeek' },
                            { value: 'OpenAI', label: 'OpenAI' },
                            { value: 'Qwen', label: 'Qwen' },
                            { value: 'Google', label: 'Google / Gemini' },
                          ]}
                          onChange={setProviderDocSelection}
                          style={{ width: 220 }}
                        />
                      </div>
                      {providerDocLoading ? (
                        <div className="admin-provider-docs__summary">正在加载模型说明文档...</div>
                      ) : providerDoc ? (
                        <div className="admin-provider-docs__markdown">
                          {renderMarkdown(providerDoc.markdown)}
                        </div>
                      ) : (
                        <div className="admin-provider-docs__summary">当前提供方暂无可展示的模型说明文档。</div>
                      )}
                    </div>
                  </Card>
                  <Card size="small" title="模型提供方配置" className="admin-build-summary">
                    <Form
                      form={providerForm}
                      layout="vertical"
                      onFinish={(values) => void handleSaveProvider(values)}
                    >
                      <Form.Item
                        label="提供方"
                        name="provider"
                        rules={[{ required: true, message: '请输入模型提供方' }]}
                      >
                        <AutoComplete
                          options={PROVIDER_OPTIONS}
                          onSelect={(value) => handleProviderDraftChange(value)}
                        >
                          <Input placeholder="例如：DeepSeek / OpenAI / Qwen" />
                        </AutoComplete>
                      </Form.Item>
                      <Form.Item
                        label="Base URL"
                        name="baseUrl"
                        rules={[{ required: true, message: '请输入 Base URL' }]}
                      >
                        <Input placeholder="例如：https://api.deepseek.com" />
                      </Form.Item>
                      <Form.Item
                        label="API Key"
                        name="apiKey"
                        rules={[{ required: true, message: '请输入 API Key' }]}
                      >
                        <Input.Password placeholder="请输入该提供方的 API Key" />
                      </Form.Item>
                      <Form.Item
                        label="协议"
                        name="protocol"
                        rules={[{ required: true, message: '请选择协议' }]}
                      >
                        <Select options={[{ value: 'openai_compatible', label: 'OpenAI Compatible' }]} />
                      </Form.Item>
                      <div className="admin-action-row">
                        <Button type="primary" htmlType="submit" loading={savingProvider}>
                          保存提供方
                        </Button>
                      </div>
                    </Form>
                    <Table
                      columns={providerColumns}
                      dataSource={providerConfigs.map((item) => ({ ...item, key: item.provider }))}
                      pagination={false}
                      locale={{ emptyText: '暂无提供方配置，请先添加提供方和 API Key。' }}
                    />
                  </Card>
                  <Card size="small" title="新增模型" className="admin-build-summary">
                    <Form
                      form={addOptionForm}
                      layout="vertical"
                      onFinish={(values) => void handleAddOption(values)}
                    >
                      <Form.Item
                        label="模型分类"
                        name="category"
                        rules={[{ required: true, message: '请选择模型分类' }]}
                      >
                        <Select options={MODEL_CATEGORY_OPTIONS as unknown as { value: string; label: string }[]} />
                      </Form.Item>
                      <Form.Item
                        label="模型提供方"
                        name="provider"
                        rules={[{ required: true, message: '请选择已配置的模型提供方' }]}
                        extra="请先在上方保存提供方的 Base URL 和 API Key，再选择该提供方添加模型。"
                      >
                        <Select
                          options={providerConfigs.map((item) => ({ value: item.provider, label: item.provider }))}
                          placeholder="请选择已配置提供方"
                        />
                      </Form.Item>
                      <Form.Item
                        label="模型 ID"
                        name="modelId"
                        rules={[{ required: true, message: '请输入模型 ID' }]}
                        extra="例如：deepseek-v4-flash、text-embedding-3-large、Qwen/Qwen2.5-VL-7B-Instruct。"
                      >
                        <Input placeholder="例如：deepseek-v4-flash" />
                      </Form.Item>
                      <div className="admin-action-row">
                        <Button type="primary" htmlType="submit" loading={addingOption}>
                          添加到候选列表
                        </Button>
                      </div>
                    </Form>
                  </Card>
                  <Card size="small" title="已添加模型" className="admin-build-summary">
                    <Table
                      columns={catalogColumns}
                      dataSource={catalogRows}
                      pagination={false}
                      locale={{
                        emptyText: (
                          <div className="admin-empty-state">
                            <strong>当前还没有任何模型</strong>
                            <div>系统已改为空白启动模式，请先在上方手动新增模型，然后再设为当前并执行测试。</div>
                          </div>
                        ),
                      }}
                    />
                  </Card>
                </div>
              ),
            },
          ]}
        />
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
          (item: { sessionId: string; question: string; helpful: boolean; rating: number; comment: string }) => ({
            key: `${item.sessionId}-${item.question}`,
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
      <Form layout="inline" className="admin-filter-row">
        <Form.Item label="关键词">
          <Input placeholder="搜索问题关键词" />
        </Form.Item>
        <Form.Item label="满意度">
          <Select
            style={{ width: 180 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'good', label: '有帮助' },
              { value: 'bad', label: '待优化' },
            ]}
          />
        </Form.Item>
        <Button type="primary">查询</Button>
      </Form>
    </Card>
  )
}

function renderPanel(activeKey: MenuKey) {
  switch (activeKey) {
    case 'knowledge':
      return <KnowledgePanel />
    case 'spots':
      return <SpotsPanel />
    case 'spot-add':
      return <SpotAddPage />
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
    case 'feedback':
      return <FeedbackPanel />
    case 'qa':
      return <QaPanel />
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
  const [activeKey, setActiveKey] = useState<MenuKey>('dashboard')

  return (
    <Layout className="admin-shell">
      <Sider width={248} className="admin-sider">
        <div className="admin-brand">
          <strong>数字人管理后台</strong>
          <span>{user.displayName}</span>
        </div>
        <div className="admin-sider__nav">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[activeKey]}
            items={menuItems}
            onClick={({ key }) => {
              if (key === 'spots') {
                return
              }
              setActiveKey(key as MenuKey)
            }}
          />
        </div>
        <div className="admin-sider__footer">
          <Button
            type={activeKey === 'settings' ? 'primary' : 'text'}
            icon={<SettingOutlined />}
            className="admin-settings-entry"
            onClick={() => setActiveKey('settings')}
          >
            设置
          </Button>
        </div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-header__actions">
            <Tag color="blue">{user.role}</Tag>
            <Button icon={<UserOutlined />} onClick={onLogout}>退出登录</Button>
          </div>
        </Header>
        <Content className="admin-content">{renderPanel(activeKey)}</Content>
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post<LoginResult>('/api/auth/login', {
        username,
        password,
      })

      if (response.data.role !== 'ADMIN') {
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
