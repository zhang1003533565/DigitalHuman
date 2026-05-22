import { type FormEvent, useEffect, useMemo, useState } from 'react'
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
  multimodalModel: string
}

type ModelCategory = 'embedding' | 'speech' | 'vision' | 'multimodal'

type AdminModelOption = {
  category: ModelCategory
  provider: string
  modelId: string
}

type AdminModelCatalog = {
  embeddingModels: AdminModelOption[]
  speechModels: AdminModelOption[]
  visionModels: AdminModelOption[]
  multimodalModels: AdminModelOption[]
}

type AddModelOptionForm = {
  category: ModelCategory
  provider: string
  modelId: string
}

type AdminProviderConfig = {
  provider: string
  baseUrl: string
  apiKey: string
}

type ProviderSyncForm = {
  provider: string
  baseUrl: string
  apiKey: string
  category: ModelCategory
}

const PROVIDER_OPTIONS = [
  { value: 'DeepSeek', label: 'DeepSeek' },
  { value: 'OpenAI', label: 'OpenAI' },
  { value: 'Qwen', label: 'Qwen' },
  { value: 'Google', label: 'Google' },
  { value: 'Azure', label: 'Azure' },
  { value: 'Custom', label: 'Custom' },
]

const MODEL_CATEGORY_OPTIONS = [
  { value: 'embedding', label: '嵌入模型' },
  { value: 'speech', label: '语音模型' },
  { value: 'vision', label: '视觉模型' },
  { value: 'multimodal', label: '多模态/对话模型' },
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
  const [providerForm] = Form.useForm<ProviderSyncForm>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addingOption, setAddingOption] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [syncingProvider, setSyncingProvider] = useState(false)
  const [catalog, setCatalog] = useState<AdminModelCatalog>({
    embeddingModels: [],
    speechModels: [],
    visionModels: [],
    multimodalModels: [],
  })
  const [providerConfigs, setProviderConfigs] = useState<AdminProviderConfig[]>([])

  const embeddingOptions = useMemo(
    () => catalog.embeddingModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.embeddingModels],
  )
  const speechOptions = useMemo(
    () => catalog.speechModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.speechModels],
  )
  const visionOptions = useMemo(
    () => catalog.visionModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.visionModels],
  )
  const multimodalOptions = useMemo(
    () => catalog.multimodalModels.map((item) => ({ value: item.modelId, label: `${item.provider} · ${item.modelId}` })),
    [catalog.multimodalModels],
  )

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)
      try {
        const [settingsResponse, catalogResponse, providerConfigsResponse] = await Promise.all([
          axios.get<AdminModelSettings>('/api/admin/settings/models'),
          axios.get<AdminModelCatalog>('/api/admin/settings/model-options'),
          axios.get<AdminProviderConfig[]>('/api/admin/settings/provider-configs'),
        ])
        form.setFieldsValue(settingsResponse.data)
        setCatalog(catalogResponse.data)
        setProviderConfigs(providerConfigsResponse.data)
        addOptionForm.setFieldsValue({
          category: 'multimodal',
          provider: 'DeepSeek',
          modelId: '',
        })
        const deepSeekConfig = providerConfigsResponse.data.find((item) => item.provider === 'DeepSeek')
        providerForm.setFieldsValue({
          provider: deepSeekConfig?.provider ?? 'DeepSeek',
          baseUrl: deepSeekConfig?.baseUrl ?? 'https://api.deepseek.com',
          apiKey: deepSeekConfig?.apiKey ?? '',
          category: 'multimodal',
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

    void loadSettings()
  }, [addOptionForm, form, providerForm])

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

  const applyProviderPreset = (provider: string) => {
    const existing = providerConfigs.find((item) => item.provider === provider)
    providerForm.setFieldsValue({
      provider,
      baseUrl: existing?.baseUrl ?? (provider === 'DeepSeek' ? 'https://api.deepseek.com' : ''),
      apiKey: existing?.apiKey ?? '',
      category: providerForm.getFieldValue('category') ?? 'multimodal',
    })
  }

  const handleSaveProvider = async (values: ProviderSyncForm) => {
    setSavingProvider(true)
    try {
      const response = await axios.put<AdminProviderConfig>('/api/admin/settings/provider-configs', {
        provider: values.provider,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey,
      })
      setProviderConfigs((current) => {
        const next = current.filter((item) => item.provider !== response.data.provider)
        return [...next, response.data].sort((left, right) => left.provider.localeCompare(right.provider))
      })
      providerForm.setFieldsValue({
        ...values,
        provider: response.data.provider,
        baseUrl: response.data.baseUrl,
        apiKey: response.data.apiKey,
      })
      message.success(`已保存 ${response.data.provider} 连接配置`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '供应商配置保存失败，请检查后端服务。'
        : '供应商配置保存失败，请稍后重试。'
      message.error(description)
    } finally {
      setSavingProvider(false)
    }
  }

  const handleSyncProviderModels = async () => {
    const values = await providerForm.validateFields()
    setSyncingProvider(true)
    try {
      const syncResponse = await axios.post('/api/admin/settings/provider-models/sync', values)
      const catalogResponse = await axios.get<AdminModelCatalog>('/api/admin/settings/model-options')
      setCatalog(catalogResponse.data)
      setProviderConfigs((current) => {
        const next = current.filter((item) => item.provider !== values.provider)
        return [...next, {
          provider: values.provider,
          baseUrl: values.baseUrl,
          apiKey: values.apiKey,
        }].sort((left, right) => left.provider.localeCompare(right.provider))
      })
      message.success(`已同步 ${syncResponse.data.syncedCount} 个官方模型`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '官方模型同步失败，请检查 URL、Key 或网络。'
        : '官方模型同步失败，请稍后重试。'
      message.error(description)
    } finally {
      setSyncingProvider(false)
    }
  }

  const renderSaveActions = () => (
    <div className="admin-action-row">
      <Button type="primary" htmlType="submit" loading={saving}>
        保存设置
      </Button>
      <Button onClick={() => form.resetFields()} disabled={saving || loading}>
        重置表单
      </Button>
    </div>
  )

  const modelSettingTabItems = [
    {
      key: 'embedding',
      label: '嵌入模型',
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
          {renderSaveActions()}
        </Form>
      ),
    },
    {
      key: 'speech',
      label: '语音模型',
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="语音模型"
            name="speechModel"
            rules={[{ required: true, message: '请输入语音模型' }]}
            extra="用于数字人播报和文本转语音。"
          >
            <AutoComplete options={speechOptions}>
              <Input placeholder="例如：zh-CN-XiaoxiaoNeural" />
            </AutoComplete>
          </Form.Item>
          {renderSaveActions()}
        </Form>
      ),
    },
    {
      key: 'vision',
      label: '视觉模型',
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
          {renderSaveActions()}
        </Form>
      ),
    },
    {
      key: 'multimodal',
      label: '多模态模型',
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="多模态/对话模型"
            name="multimodalModel"
            rules={[{ required: true, message: '请输入多模态模型' }]}
            extra="用于图文联合理解、复杂问答，DeepSeek 这类对话模型也可以挂在这里统一管理。"
          >
            <AutoComplete options={multimodalOptions}>
              <Input placeholder="例如：deepseek-v4-flash" />
            </AutoComplete>
          </Form.Item>
          {renderSaveActions()}
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
              label: '官方同步',
              children: (
                <div className="admin-form-grid">
                  <Card size="small" className="admin-build-summary">
                    先配置供应商连接，再从官方接口同步模型。以 DeepSeek 为例，填写 `https://api.deepseek.com` 和 API Key 后即可拉取官方现有模型，后续新模型也能再次同步进入候选列表。
                  </Card>
                  <Form
                    form={providerForm}
                    layout="vertical"
                    onFinish={(values) => void handleSaveProvider(values)}
                  >
                    <Form.Item
                      label="模型提供方"
                      name="provider"
                      rules={[{ required: true, message: '请选择或输入提供方' }]}
                    >
                      <AutoComplete
                        options={PROVIDER_OPTIONS}
                        onSelect={(value) => applyProviderPreset(value)}
                      >
                        <Input
                          placeholder="例如：DeepSeek"
                          onBlur={(event) => {
                            const nextProvider = event.target.value.trim()
                            if (nextProvider) {
                              applyProviderPreset(nextProvider)
                            }
                          }}
                        />
                      </AutoComplete>
                    </Form.Item>
                    <Form.Item
                      label="API URL"
                      name="baseUrl"
                      rules={[{ required: true, message: '请输入 API URL' }]}
                      extra="DeepSeek 官方地址为 https://api.deepseek.com"
                    >
                      <Input placeholder="例如：https://api.deepseek.com" />
                    </Form.Item>
                    <Form.Item
                      label="API Key"
                      name="apiKey"
                      rules={[{ required: true, message: '请输入 API Key' }]}
                    >
                      <Input.Password placeholder="请输入供应商 API Key" />
                    </Form.Item>
                    <Form.Item
                      label="同步到模型分类"
                      name="category"
                      rules={[{ required: true, message: '请选择模型分类' }]}
                    >
                      <Select options={MODEL_CATEGORY_OPTIONS as unknown as { value: string; label: string }[]} />
                    </Form.Item>
                    <div className="admin-action-row">
                      <Button type="primary" htmlType="submit" loading={savingProvider}>
                        保存连接配置
                      </Button>
                      <Button onClick={() => void handleSyncProviderModels()} loading={syncingProvider}>
                        同步官方模型
                      </Button>
                    </div>
                  </Form>
                  <Card size="small" title="手动补充模型" className="admin-build-summary">
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
                        rules={[{ required: true, message: '请选择或输入提供方' }]}
                      >
                        <AutoComplete options={PROVIDER_OPTIONS}>
                          <Input placeholder="例如：DeepSeek" />
                        </AutoComplete>
                      </Form.Item>
                      <Form.Item
                        label="模型 ID"
                        name="modelId"
                        rules={[{ required: true, message: '请输入模型 ID' }]}
                        extra="当官方刚出新模型但你还不想走同步时，可以在这里手动补充。"
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
