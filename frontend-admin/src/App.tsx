import { type FormEvent, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  BuildOutlined,
  DatabaseOutlined,
  UserOutlined,
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
} from 'antd'
import type { UploadProps } from 'antd'
import type { TableColumnsType } from 'antd'
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
import './App.css'

const { Header, Content } = Layout
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
  return (
    <div className="admin-panel-grid">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="今日服务人次" value={128} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="本周服务人次" value={986} />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="负面反馈占比" value={12.4} suffix="%" />
          </Card>
        </Col>
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
      const response = await axios.post('/api/admin/knowledge/build', { recreateCollection })
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
          <Button icon={<BuildOutlined />} loading={building} onClick={() => void buildKnowledgeBase(false)}>
            开始构建
          </Button>
          <Button danger loading={building} onClick={() => void buildKnowledgeBase(true)}>
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
      <Card title="数字人基础配置" extra={<Tag color="blue">业务配置</Tag>}>
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [voiceOptions, setVoiceOptions] = useState<{ value: string; label: string }[]>([])
  const [testingCategory, setTestingCategory] = useState<ModelCategory | null>(null)
  const [testResults, setTestResults] = useState<Partial<Record<ModelCategory, ModelTestResponse>>>({})
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
  }, [])

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

  const handleTestModel = async (category: ModelCategory) => {
    const fieldName = fieldNameByCategory[category]
    const values = await form.validateFields([fieldName])
    const modelId = values[fieldName] as string
    const speechValues = category === 'speech' ? await speechTestForm.validateFields(['speechTestText']) : null
    setTestingCategory(category)
    try {
      const response = await axios.post<ModelTestResponse>('/api/admin/settings/model-test', {
        category,
        modelId,
        text: category === 'speech' ? speechValues?.speechTestText : undefined,
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
          onSave={() => void handleSave()}
          onTest={() => void handleTestModel('vision')}
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
          onSave={() => void handleSave()}
          onTest={() => void handleTestModel('multimodal')}
          result={renderTestResult('multimodal', testResults.multimodal)}
        />
      ),
    },
    {
      key: 'model-catalog',
      label: '手动维护',
      children: <ModelManualPage />,
    },
  ]

  return (
    <div className="admin-panel-grid">
      <Card title="系统设置" extra={<Tag color="blue">左下角入口</Tag>} className="admin-settings-card">
        <Tabs defaultActiveKey="embedding" items={settingsTabs} />
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
  const [spotDrawerOpen, setSpotDrawerOpen] = useState(false)

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
        onSelect={(key) => setActiveKey(key as MenuKey)}
      />
      <Layout>
        <Header className="admin-header">
          <div className="admin-header__actions">
            <Tag color="blue">{user.role}</Tag>
            <Button icon={<UserOutlined />} onClick={onLogout}>退出登录</Button>
          </div>
        </Header>
        <Content className="admin-content">
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
