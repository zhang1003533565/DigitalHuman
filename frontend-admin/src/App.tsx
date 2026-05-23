import { type FormEvent, type JSX, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import * as XLSX from 'xlsx'
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
import { Layout, Menu, Button, Card, Form, Input, Table, Tag, Statistic, Row, Col, Upload, Select, AutoComplete, Tabs, message, Tooltip } from 'antd'
import type { UploadProps } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import SpotDrawer from './pages/SpotAddPage'
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
  | 'spot-category'
  | 'facility-list'
  | 'routes'
  | 'avatar'
  | 'settings'
  | 'travel-analytics'
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
  { value: 'embedding', label: '宓屽叆妯″瀷' },
  { value: 'speech', label: '璇煶妯″瀷' },
  { value: 'vision', label: '瑙嗚妯″瀷' },
  { value: 'chat', label: '瀵硅瘽妯″瀷' },
  { value: 'multimodal', label: '澶氭ā鎬佹ā鍨? },
] as const

const spotColumns: TableColumnsType<SpotRow> = [
  { title: '鏅偣鍚嶇О', dataIndex: 'name' },
  { title: '鎵€灞炲洯鍖?, dataIndex: 'area' },
  { title: '寮€鏀炬椂闂?, dataIndex: 'openHours' },
  {
    title: '鏍囩',
    dataIndex: 'tags',
    render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>),
  },
]

const routeColumns: TableColumnsType<RouteRow> = [
  { title: '璺嚎鍚嶇О', dataIndex: 'name' },
  { title: '閫傚悎浜虹兢', dataIndex: 'suitableFor' },
  { title: '鏃堕暱', dataIndex: 'duration' },
]

const feedbackColumns: TableColumnsType<FeedbackRow> = [
  { title: '闂', dataIndex: 'question' },
  { title: '甯姪鎯呭喌', dataIndex: 'helpful' },
  { title: '璇勫垎', dataIndex: 'rating' },
  { title: '鎰忚', dataIndex: 'comment' },
]

const knowledgeColumns: TableColumnsType<KnowledgeDocumentRow> = [
  { title: '鏂囦欢鍚?, dataIndex: 'fileName' },
  { title: '澶у皬', dataIndex: 'sizeText' },
  { title: '鏇存柊鏃堕棿', dataIndex: 'updatedAt' },
  {
    title: '鐘舵€?,
    dataIndex: 'supported',
    render: (supported: boolean) => (
      <Tag color={supported ? 'green' : 'red'}>{supported ? '鍙敤' : '鏍煎紡涓嶆敮鎸?}</Tag>
    ),
  },
]

const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <BarChartOutlined />, label: '鏁版嵁鎬昏' },
  { key: 'knowledge', icon: <BookOutlined />, label: '鐭ヨ瘑搴撶鐞? },
  {
    key: 'spots',
    icon: <EnvironmentOutlined />,
    label: '鏅偣绠＄悊',
    children: [
      { key: 'spot-category', label: '鏅偣鍒嗙被' },
      { key: 'facility-list', label: '鍏ㄩ儴璁炬柦' },
    ],
  },
  { key: 'routes', icon: <NodeIndexOutlined />, label: '璺嚎绠＄悊' },
  { key: 'avatar', icon: <RobotOutlined />, label: '鏁板瓧浜洪厤缃? },
  { key: 'feedback', icon: <CommentOutlined />, label: '娓稿鍙嶉鍒嗘瀽' },
  { key: 'qa', icon: <SearchOutlined />, label: '闂瓟璁板綍鏌ヨ' },
  { key: 'travel-analytics', icon: <DatabaseOutlined />, label: '鏃呮父鏁版嵁琛屼负鍒嗘瀽' },
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
        <Col xs={24} md={8}><Card><Statistic title="浠婃棩鏈嶅姟浜烘" value={128} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="鏈懆鏈嶅姟浜烘" value={986} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="璐熼潰鍙嶉鍗犳瘮" value={12.4} suffix="%" /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="鐑棬闂 Top3">
            <ul className="admin-list">
              <li>鐏靛北澶т經鏈変粈涔堝巻鍙诧紵</li>
              <li>浜插瓙璺嚎鎬庝箞瀹夋帓锛?/li>
              <li>鎷堣姳婀炬櫄涓婇€傚悎鍘诲悧锛?/li>
            </ul>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="楂橀鏅偣鍏虫敞鎺掕">
            <ul className="admin-list">
              <li>鐏靛北澶т經</li>
              <li>涔濋緳鐏屾荡</li>
              <li>鎷堣姳濉?/li>
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
          ? `鍏ㄩ噺閲嶅缓瀹屾垚锛屽凡鍐欏叆 ${result.chunksIndexed} 涓煡璇嗗潡`
          : `鐭ヨ瘑搴撴瀯寤哄畬鎴愶紝宸插啓鍏?${result.chunksIndexed} 涓煡璇嗗潡`,
      )
      await loadDocuments()
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '鐭ヨ瘑搴撴瀯寤哄け璐ワ紝璇锋鏌?AI 鏈嶅姟銆?
        : '鐭ヨ瘑搴撴瀯寤哄け璐ワ紝璇风◢鍚庨噸璇曘€?
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
        message.success(`涓婁紶鎴愬姛锛屾枃浠?${response.data.fileName} 宸插姞鍏ュ緟鏋勫缓鍒楄〃`)
        await loadDocuments()
        onSuccess?.(response.data)
      } catch (error) {
        const description = axios.isAxiosError(error)
          ? error.response?.data?.message ?? '涓婁紶澶辫触锛岃妫€鏌ョ煡璇嗗簱鏈嶅姟銆?
          : '涓婁紶澶辫触锛岃绋嶅悗閲嶈瘯銆?
        message.error(description)
        onError?.(error as Error)
      } finally {
        setUploading(false)
      }
    },
  }

  return (
    <Card
      title="鐭ヨ瘑搴撶鐞?
      extra={(
        <div className="admin-action-row">
          <Upload {...uploadProps}>
            <Button type="primary" loading={uploading}>涓婁紶鏂囦欢</Button>
          </Upload>
          <Button
            icon={<BuildOutlined />}
            loading={building}
            onClick={() => void buildKnowledgeBase(false)}
          >
            寮€濮嬫瀯寤?
          </Button>
          <Button
            danger
            loading={building}
            onClick={() => void buildKnowledgeBase(true)}
          >
            鍏ㄩ噺閲嶅缓
          </Button>
        </div>
      )}
    >
      <div className="admin-form-grid">
        <Upload {...uploadProps}>
          <Button icon={<DatabaseOutlined />} loading={uploading}>閫夋嫨鏅尯璧勬枡</Button>
        </Upload>
        <div className="admin-inline-meta">
          <Tag color="blue">鏀寔 docx</Tag>
          <Tag color="gold">鏀寔 pdf</Tag>
          <Tag color="purple">鏀寔 txt</Tag>
          <Tag color="cyan">涓婁紶鍚庨渶鎵嬪姩鏋勫缓</Tag>
        </div>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="寰呮瀯寤烘枃浠舵暟" value={documents.length} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="涓婃鎵弿鏂囦欢鏁? value={lastBuildResult?.filesSeen ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="涓婃鍏ュ簱鏂囦欢鏁? value={lastBuildResult?.filesIndexed ?? 0} />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card size="small">
              <Statistic title="涓婃鐭ヨ瘑鍧楁暟" value={lastBuildResult?.chunksIndexed ?? 0} />
            </Card>
          </Col>
        </Row>
        {lastBuildResult ? (
          <Card size="small" className="admin-build-summary">
            鏈€杩戜竴娆℃瀯寤哄啓鍏ラ泦鍚?`{lastBuildResult.collection}`锛屽叡澶勭悊 {lastBuildResult.filesIndexed} 涓枃浠讹紝鐢熸垚 {lastBuildResult.chunksIndexed} 涓煡璇嗗潡銆?
            <div className="admin-build-summary__time">
              鏋勫缓鏃堕棿锛歿new Date(lastBuildResult.builtAt).toLocaleString('zh-CN')}
            </div>
          </Card>
        ) : (
          <Card size="small" className="admin-build-summary admin-build-summary--muted">
            涓婁紶鏂囦欢鍙細淇濆瓨鍒扮煡璇嗗簱鐩綍銆傜偣鍑烩€滃紑濮嬫瀯寤衡€濆悗锛岀郴缁熸墠浼氭墽琛屾枃妗ｈВ鏋愩€佺墖娈垫媶鍒嗐€丒mbedding 鍜屽悜閲忓啓鍏ャ€?
          </Card>
        )}
        <Table
          columns={knowledgeColumns}
          dataSource={documents}
          pagination={false}
          locale={{ emptyText: '鏆傛棤宸蹭笂浼犵煡璇嗘枃浠讹紝璇峰厛涓婁紶鏅尯璧勬枡銆? }}
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
    <Card title="鏅偣绠＄悊" extra={<Button type="primary">鏂板鏅偣</Button>}>
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
    <Card title="璺嚎绠＄悊" extra={<Button type="primary">鍒涘缓璺嚎</Button>}>
      <Table columns={routeColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function AvatarPanel() {
  return (
    <div className="admin-panel-grid">
      <Card
        title="鏁板瓧浜哄熀纭€閰嶇疆"
        extra={<Tag color="blue">涓氬姟閰嶇疆</Tag>}
      >
        <div className="admin-form-grid">
          <Card size="small" className="admin-build-summary">
            褰撳墠椤靛彧淇濈暀鏁板瓧浜虹殑涓氬姟渚ч厤缃紝姣斿娆㈣繋璇嶃€佽瑙ｉ鏍笺€侀粯璁よ鑹插拰鎾姤绛栫暐銆?
          </Card>
          <Form layout="vertical">
            <Form.Item label="榛樿娆㈣繋璇?>
              <Input.TextArea
                rows={4}
                placeholder="渚嬪锛氭偍濂斤紝娆㈣繋鏉ュ埌鐏靛北鑳滃锛屾垜鍙互涓烘偍浠嬬粛鏅偣銆佽矾绾垮拰娲诲姩瀹夋帓銆?
              />
            </Form.Item>
            <Form.Item label="璁茶В椋庢牸">
              <Select
                placeholder="璇烽€夋嫨璁茶В椋庢牸"
                options={[
                  { value: 'friendly', label: '浜插垏璁茶В' },
                  { value: 'professional', label: '涓撲笟瀵艰' },
                  { value: 'family', label: '浜插瓙浜掑姩' },
                ]}
              />
            </Form.Item>
            <Form.Item label="榛樿鎾姤绛栫暐">
              <Select
                placeholder="璇烽€夋嫨鎾姤绛栫暐"
                options={[
                  { value: 'standard', label: '鏍囧噯鎾姤' },
                  { value: 'brief', label: '绠€娲佹挱鎶? },
                  { value: 'storytelling', label: '鏁呬簨鍖栨挱鎶? },
                ]}
              />
            </Form.Item>
            <div className="admin-action-row">
              <Button type="primary">淇濆瓨鏁板瓧浜洪厤缃?/Button>
            </div>
          </Form>
        </div>
      </Card>
      <Card title="閰嶇疆璇存槑">
        <ul className="admin-list">
          <li>妯″瀷鑳藉姏閰嶇疆宸茬粺涓€杩佺Щ鍒板乏涓嬭鈥滆缃€濄€?/li>
          <li>杩欓噷寤鸿鍙斁鏁板瓧浜鸿鑹层€佽瘽鏈€佸姩浣滅瓥鐣ョ瓑涓氬姟鍙傛暟銆?/li>
          <li>鍚庣画濡傛灉鎺ョ湡瀹炴帴鍙ｏ紝鍙互鐩存帴娌跨敤褰撳墠琛ㄥ崟缁撴瀯銆?/li>
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
    () => catalog.embeddingModels.map((item) => ({ value: item.modelId, label: `${item.provider} 路 ${item.modelId}` })),
    [catalog.embeddingModels],
  )
  const visionOptions = useMemo(
    () => catalog.visionModels.map((item) => ({ value: item.modelId, label: `${item.provider} 路 ${item.modelId}` })),
    [catalog.visionModels],
  )
  const chatOptions = useMemo(
    () => catalog.chatModels.map((item) => ({ value: item.modelId, label: `${item.provider} 路 ${item.modelId}` })),
    [catalog.chatModels],
  )
  const multimodalOptions = useMemo(
    () => catalog.multimodalModels.map((item) => ({ value: item.modelId, label: `${item.provider} 路 ${item.modelId}` })),
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
        ? error.response?.data?.message ?? '妯″瀷璁剧疆鍔犺浇澶辫触锛岃妫€鏌ュ悗绔湇鍔°€?
        : '妯″瀷璁剧疆鍔犺浇澶辫触锛岃绋嶅悗閲嶈瘯銆?
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
          ? error.response?.data?.message ?? '璇诲彇妯″瀷璇存槑鏂囨。澶辫触銆?
          : '璇诲彇妯″瀷璇存槑鏂囨。澶辫触銆?
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
      message.success('妯″瀷璁剧疆宸蹭繚瀛?)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '妯″瀷璁剧疆淇濆瓨澶辫触锛岃妫€鏌ュ悗绔湇鍔°€?
        : '妯″瀷璁剧疆淇濆瓨澶辫触锛岃绋嶅悗閲嶈瘯銆?
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
      message.success(`妯″瀷 ${values.modelId} 宸插姞鍏ュ€欓€夊垪琛╜)
      addOptionForm.setFieldsValue({
        ...values,
        modelId: '',
      })
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '鏂板妯″瀷澶辫触锛岃妫€鏌ュ悗绔湇鍔°€?
        : '鏂板妯″瀷澶辫触锛岃绋嶅悗閲嶈瘯銆?
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
      message.success(`宸蹭繚瀛樻彁渚涙柟 ${response.data.provider}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '淇濆瓨妯″瀷鎻愪緵鏂瑰け璐ワ紝璇锋鏌ュ悗绔湇鍔°€?
        : '淇濆瓨妯″瀷鎻愪緵鏂瑰け璐ワ紝璇风◢鍚庨噸璇曘€?
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
      message.success(`宸插垹闄ゆ彁渚涙柟 ${provider}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '鍒犻櫎妯″瀷鎻愪緵鏂瑰け璐ワ紝璇锋鏌ュ悗绔湇鍔°€?
        : '鍒犻櫎妯″瀷鎻愪緵鏂瑰け璐ワ紝璇风◢鍚庨噸璇曘€?
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
    message.info(`宸茶浇鍏?${providerConfig.provider} 閰嶇疆锛屽彲鐩存帴淇敼鍚庝繚瀛榒)
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
        ? error.response?.data?.message ?? '妯″瀷娴嬭瘯澶辫触锛岃妫€鏌ユ湇鍔￠厤缃€?
        : '妯″瀷娴嬭瘯澶辫触锛岃绋嶅悗閲嶈瘯銆?
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
        ? error.response?.data?.message ?? '妯″瀷娴嬭瘯澶辫触锛岃妫€鏌ユ湇鍔￠厤缃€?
        : '妯″瀷娴嬭瘯澶辫触锛岃绋嶅悗閲嶈瘯銆?
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
      message.success(`宸插垏鎹㈠埌妯″瀷 ${row.modelId}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '璁剧疆褰撳墠妯″瀷澶辫触锛岃妫€鏌ュ悗绔湇鍔°€?
        : '璁剧疆褰撳墠妯″瀷澶辫触锛岃绋嶅悗閲嶈瘯銆?
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
      message.success(`宸插垹闄ゆā鍨?${row.modelId}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '鍒犻櫎妯″瀷澶辫触锛岃妫€鏌ュ悗绔湇鍔°€?
        : '鍒犻櫎妯″瀷澶辫触锛岃绋嶅悗閲嶈瘯銆?
      message.error(description)
    } finally {
      setDeletingRowKey(null)
    }
  }

  const catalogColumns: TableColumnsType<ModelCatalogRow> = [
    {
      title: '鍒嗙被',
      dataIndex: 'category',
      render: (value: ModelCategory) => MODEL_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value,
    },
    { title: '鎻愪緵鏂?, dataIndex: 'provider' },
    { title: '妯″瀷 ID', dataIndex: 'modelId' },
    {
      title: '鐘舵€?,
      dataIndex: 'selected',
      render: (selected: boolean) => (
        <Tag color={selected ? 'green' : 'default'}>{selected ? '褰撳墠浣跨敤' : '鍊欓€?}</Tag>
      ),
    },
    {
      title: '鎿嶄綔',
      key: 'actions',
      render: (_, row) => (
        <div className="admin-action-row">
          <Button size="small" onClick={() => void handleTestModelRow(row)} loading={testingRowKey === row.key}>
            娴嬭瘯
          </Button>
          <Button size="small" type="primary" ghost onClick={() => void handleSelectModelRow(row)} loading={selectingRowKey === row.key}>
            璁句负褰撳墠
          </Button>
          <Button size="small" danger onClick={() => void handleDeleteModelRow(row)} loading={deletingRowKey === row.key}>
            鍒犻櫎
          </Button>
        </div>
      ),
    },
  ]

  const providerColumns: TableColumnsType<ProviderConfig> = [
    { title: '鎻愪緵鏂?, dataIndex: 'provider' },
    { title: '鍗忚', dataIndex: 'protocol' },
    { title: 'Base URL', dataIndex: 'baseUrl' },
    {
      title: 'API Key',
      dataIndex: 'apiKey',
      render: (value: string) => (value ? `***${value.slice(-4)}` : '-'),
    },
    {
      title: '鎿嶄綔',
      key: 'actions',
      render: (_, row) => (
        <div className="admin-action-row">
          <Button
            size="small"
            onClick={() => handleEditProvider(row)}
          >
            缂栬緫
          </Button>
          <Button
            size="small"
            danger
            onClick={() => void handleDeleteProvider(row.provider)}
            loading={deletingProvider === row.provider}
          >
            鍒犻櫎
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
        淇濆瓨璁剧疆
      </Button>
      <Button onClick={() => void handleTestModel(category)} loading={testingCategory === category}>
        娴嬭瘯褰撳墠妯″瀷
      </Button>
      <Button onClick={() => form.resetFields()} disabled={saving || loading}>
        閲嶇疆琛ㄥ崟
      </Button>
    </div>
  )

  const renderTestResult = (category: ModelCategory) => {
    const result = testResults[category]
    if (!result) {
      return null
    }

    const isSoftSuccess = result.success && result.detail?.includes('鍐呭涓虹┖')
    const title = result.success ? (isSoftSuccess ? '妯″瀷宸茶繛閫? : '娴嬭瘯鎴愬姛') : '娴嬭瘯澶辫触'
    const summary = result.success
      ? (isSoftSuccess
        ? '鎺ュ彛宸茬粡鎵撻€氾紝妯″瀷涔熸湁鍝嶅簲锛屼絾杩欐鍋ュ悍妫€鏌ユ病鏈夎繑鍥炲彲灞曠ず鏂囨湰銆傞€氬父涓嶅奖鍝嶇户缁厤缃娇鐢ㄣ€?
        : '妯″瀷鎺ュ彛璋冪敤鎴愬姛锛屽綋鍓嶉厤缃彲缁х画浣跨敤銆?)
      : result.message
    const detail = result.success
      ? (isSoftSuccess ? '寤鸿锛氬彲浠ョ户缁湪鐪熷疄涓氬姟鍦烘櫙閲屽啀娴嬩竴杞棶绛旀垨鍥炬枃杈撳叆銆? : result.detail ?? '褰撳墠娴嬭瘯宸查€氳繃銆?)
      : result.detail ?? '璇锋鏌ユ彁渚涙柟閰嶇疆銆佹ā鍨嬪悕绉版垨璐︽埛鐘舵€併€?

    return (
      <Card
        size="small"
        className={`admin-build-summary ${result.success ? '' : 'admin-build-summary--danger'}`}
      >
        <div className="admin-test-result">
          <div className="admin-test-result__header">
            <strong>{title}</strong>
            <Tag color={result.success ? (isSoftSuccess ? 'blue' : 'green') : 'red'}>
              {result.success ? (isSoftSuccess ? '宸茶繛閫? : '鍙敤') : '涓嶅彲鐢?}
            </Tag>
          </div>
          <div className="admin-test-result__meta">
            <span>妯″瀷锛歿result.modelId}</span>
            {result.provider ? <span>鎻愪緵鏂癸細{result.provider}</span> : null}
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
            {result.success ? '宸查€氳繃' : '澶辫触'}
          </Tag>
        ) : null}
      </span>
    )
  }

  const modelSettingTabItems = [
    {
      key: 'embedding',
      label: renderTabLabel('embedding', '宓屽叆妯″瀷'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="宓屽叆妯″瀷"
            name="embeddingModel"
            rules={[{ required: true, message: '璇疯緭鍏ュ祵鍏ユā鍨? }]}
            extra="鐢ㄤ簬鐭ヨ瘑搴撳垎鍧楀悜閲忓寲涓庣浉浼煎害妫€绱€?
          >
            <AutoComplete options={embeddingOptions}>
              <Input placeholder="渚嬪锛欱AAI/bge-m3" />
            </AutoComplete>
          </Form.Item>
          {renderActions('embedding')}
          {renderTestResult('embedding')}
        </Form>
      ),
    },
    {
      key: 'speech',
      label: renderTabLabel('speech', '璇煶妯″瀷'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="璇煶妯″瀷"
            name="speechModel"
            rules={[{ required: true, message: '璇疯緭鍏ヨ闊虫ā鍨? }]}
            extra="鐢ㄤ簬鏁板瓧浜烘挱鎶ュ拰鏂囨湰杞闊筹紝褰撳墠浼氱洿鎺ュ睍绀烘湰鍦?edge-tts 鏀寔鐨勮闊冲垪琛ㄣ€?
          >
            <AutoComplete options={voiceOptions}>
              <Input placeholder="渚嬪锛歾h-CN-XiaoxiaoNeural" />
            </AutoComplete>
          </Form.Item>
          {renderActions('speech')}
          {renderTestResult('speech')}
        </Form>
      ),
    },
    {
      key: 'vision',
      label: renderTabLabel('vision', '瑙嗚妯″瀷'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="瑙嗚妯″瀷"
            name="visionModel"
            rules={[{ required: true, message: '璇疯緭鍏ヨ瑙夋ā鍨? }]}
            extra="鐢ㄤ簬鍥剧墖鐞嗚В銆佹櫙鍖鸿瘑鍒拰瑙嗚闂瓟銆?
          >
            <AutoComplete options={visionOptions}>
              <Input placeholder="渚嬪锛歈wen/Qwen2.5-VL-7B-Instruct" />
            </AutoComplete>
          </Form.Item>
          {renderActions('vision')}
          {renderTestResult('vision')}
        </Form>
      ),
    },
    {
      key: 'chat',
      label: renderTabLabel('chat', '瀵硅瘽妯″瀷'),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="瀵硅瘽妯″瀷"
            name="chatModel"
            rules={[{ required: true, message: '璇疯緭鍏ュ璇濇ā鍨? }]}
            extra="鐢ㄤ簬绾枃鏈璇濄€侀棶绛斻€佹帹鐞嗙瓑鍦烘櫙銆?
          >
            <AutoComplete options={chatOptions}>
              <Input placeholder="渚嬪锛歞eepseek-v4-flash / gpt-4.1 / qwen-max" />
            </AutoComplete>
          </Form.Item>
          {renderActions('chat')}
          {renderTestResult('chat')}
        </Form>
      ),
    },
    {
      key: 'multimodal',
      label: renderTabLabel('multimodal', '澶氭ā鎬佹ā鍨?),
      children: (
        <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)} disabled={loading} className="admin-settings-form">
          <Form.Item
            label="澶氭ā鎬佹ā鍨?
            name="multimodalModel"
            rules={[{ required: true, message: '璇疯緭鍏ュ妯℃€佹ā鍨? }]}
            extra="鐢ㄤ簬鍥炬枃鑱斿悎鐞嗚В銆佸浘鐗囬棶绛斻€佽瑙夋帹鐞嗙瓑澶氭ā鎬佸満鏅€?
          >
            <AutoComplete options={multimodalOptions}>
              <Input placeholder="渚嬪锛歡pt-4o / Qwen/Qwen2.5-VL-7B-Instruct" />
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
        title="绯荤粺璁剧疆"
        extra={<Tag color="blue">宸︿笅瑙掑叆鍙?/Tag>}
        className="admin-settings-card"
      >
        <Tabs
          defaultActiveKey="embedding"
          items={[
            ...modelSettingTabItems,
            {
              key: 'model-catalog',
              label: '鎵嬪姩缁存姢',
              children: (
                <div className="admin-form-grid">
                  <Card size="small" className="admin-build-summary">
                    妯″瀷鍒楄〃鏀逛负鎵嬪姩缁存姢銆傛寜鍒嗙被閫愪釜娣诲姞妯″瀷鎻愪緵鏂瑰拰妯″瀷 ID锛屾洿閫傚悎浣犲綋鍓嶄竴鏉′竴鏉￠厤缃€侀€愭鎵╁睍 provider 鑳藉姏鏂囦欢鐨勬柟寮忋€?
                  </Card>
                  <Card size="small" title="妯″瀷鑳藉姏涓庢敮鎸佹ā鍨? className="admin-build-summary">
                    <div className="admin-provider-docs">
                      <div className="admin-provider-docs__toolbar">
                        <Select
                          value={providerDocSelection}
                          options={[
                            { value: 'DeepSeek', label: 'DeepSeek' },
                            { value: 'OpenAI', label: 'OpenAI' },
                            { value: 'Qwen', label: 'Qwen' },
                            { value: 'Google', label: 'Google / Gemini' },
                            { value: 'Local TTS', label: 'Local TTS / edge-tts' },
                          ]}
                          onChange={setProviderDocSelection}
                          style={{ width: 220 }}
                        />
                      </div>
                      {providerDocLoading ? (
                        <div className="admin-provider-docs__summary">姝ｅ湪鍔犺浇妯″瀷璇存槑鏂囨。...</div>
                      ) : providerDoc ? (
                        <div className="admin-provider-docs__markdown">
                          {renderMarkdown(providerDoc.markdown)}
                        </div>
                      ) : (
                        <div className="admin-provider-docs__summary">褰撳墠鎻愪緵鏂规殏鏃犲彲灞曠ず鐨勬ā鍨嬭鏄庢枃妗ｃ€?/div>
                      )}
                    </div>
                  </Card>
                  <Card size="small" title="妯″瀷鎻愪緵鏂归厤缃? className="admin-build-summary">
                    <Form
                      form={providerForm}
                      layout="vertical"
                      onFinish={(values) => void handleSaveProvider(values)}
                    >
                      <Form.Item
                        label="鎻愪緵鏂?
                        name="provider"
                        rules={[{ required: true, message: '璇疯緭鍏ユā鍨嬫彁渚涙柟' }]}
                      >
                        <AutoComplete
                          options={PROVIDER_OPTIONS}
                          onSelect={(value) => handleProviderDraftChange(value)}
                        >
                          <Input placeholder="渚嬪锛欴eepSeek / OpenAI / Qwen" />
                        </AutoComplete>
                      </Form.Item>
                      <Form.Item
                        label="Base URL"
                        name="baseUrl"
                        rules={[{ required: true, message: '璇疯緭鍏?Base URL' }]}
                      >
                        <Input placeholder="渚嬪锛歨ttps://api.deepseek.com" />
                      </Form.Item>
                      <Form.Item
                        label="API Key"
                        name="apiKey"
                        rules={[{ required: true, message: '璇疯緭鍏?API Key' }]}
                      >
                        <Input.Password placeholder="璇疯緭鍏ヨ鎻愪緵鏂圭殑 API Key" />
                      </Form.Item>
                      <Form.Item
                        label="鍗忚"
                        name="protocol"
                        rules={[{ required: true, message: '璇烽€夋嫨鍗忚' }]}
                      >
                        <Select options={[{ value: 'openai_compatible', label: 'OpenAI Compatible' }]} />
                      </Form.Item>
                      <div className="admin-action-row">
                        <Button type="primary" htmlType="submit" loading={savingProvider}>
                          淇濆瓨鎻愪緵鏂?
                        </Button>
                      </div>
                    </Form>
                    <Table
                      columns={providerColumns}
                      dataSource={providerConfigs.map((item) => ({ ...item, key: item.provider }))}
                      pagination={false}
                      locale={{ emptyText: '鏆傛棤鎻愪緵鏂归厤缃紝璇峰厛娣诲姞鎻愪緵鏂瑰拰 API Key銆? }}
                    />
                  </Card>
                  <Card size="small" title="鏂板妯″瀷" className="admin-build-summary">
                    <Form
                      form={addOptionForm}
                      layout="vertical"
                      onFinish={(values) => void handleAddOption(values)}
                    >
                      <Form.Item
                        label="妯″瀷鍒嗙被"
                        name="category"
                        rules={[{ required: true, message: '璇烽€夋嫨妯″瀷鍒嗙被' }]}
                      >
                        <Select options={MODEL_CATEGORY_OPTIONS as unknown as { value: string; label: string }[]} />
                      </Form.Item>
                      <Form.Item
                        label="妯″瀷鎻愪緵鏂?
                        name="provider"
                        rules={[{ required: true, message: '璇烽€夋嫨宸查厤缃殑妯″瀷鎻愪緵鏂? }]}
                        extra="璇峰厛鍦ㄤ笂鏂逛繚瀛樻彁渚涙柟鐨?Base URL 鍜?API Key锛屽啀閫夋嫨璇ユ彁渚涙柟娣诲姞妯″瀷銆?
                      >
                        <Select
                          options={providerConfigs.map((item) => ({ value: item.provider, label: item.provider }))}
                          placeholder="璇烽€夋嫨宸查厤缃彁渚涙柟"
                        />
                      </Form.Item>
                      <Form.Item
                        label="妯″瀷 ID"
                        name="modelId"
                        rules={[{ required: true, message: '璇疯緭鍏ユā鍨?ID' }]}
                        extra="渚嬪锛歞eepseek-v4-flash銆乼ext-embedding-3-large銆丵wen/Qwen2.5-VL-7B-Instruct銆?
                      >
                        <Input placeholder="渚嬪锛歞eepseek-v4-flash" />
                      </Form.Item>
                      <div className="admin-action-row">
                        <Button type="primary" htmlType="submit" loading={addingOption}>
                          娣诲姞鍒板€欓€夊垪琛?
                        </Button>
                      </div>
                    </Form>
                  </Card>
                  <Card size="small" title="宸叉坊鍔犳ā鍨? className="admin-build-summary">
                    <Table
                      columns={catalogColumns}
                      dataSource={catalogRows}
                      pagination={false}
                      locale={{
                        emptyText: (
                          <div className="admin-empty-state">
                            <strong>褰撳墠杩樻病鏈変换浣曟ā鍨?/strong>
                            <div>绯荤粺宸叉敼涓虹┖鐧藉惎鍔ㄦā寮忥紝璇峰厛鍦ㄤ笂鏂规墜鍔ㄦ柊澧炴ā鍨嬶紝鐒跺悗鍐嶈涓哄綋鍓嶅苟鎵ц娴嬭瘯銆?/div>
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

function renderTruncatedCell(
  value: string,
  rowHeight: number,
  fontSize: number,
  rowKey: string,
  onRowResizeStart: (event: React.MouseEvent<HTMLDivElement>, rowKey: string, currentHeight: number) => void,
) {
  const text = (value ?? '').toString()
  const lineHeight = Math.max(18, fontSize + 6)
  const maxLines = Math.max(1, Math.floor(rowHeight / lineHeight))

  return (
    <Tooltip
      placement="topLeft"
      title={<div style={{ maxWidth: 900, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text || '-'}</div>}
    >
      <div
        style={{
          position: 'relative',
          minHeight: rowHeight,
          paddingBottom: 6,
          fontSize,
          lineHeight: `${lineHeight}px`,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          cursor: 'pointer',
        }}
      >
        {text || '-'}
        <div
          role="separator"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -3,
            height: 8,
            cursor: 'row-resize',
            zIndex: 3,
          }}
          onMouseDown={(event) => {
            event.stopPropagation()
            onRowResizeStart(event, rowKey, rowHeight)
          }}
        />
      </div>
    </Tooltip>
  )
}

function TravelAnalyticsPanel() {
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState<TableColumnsType<Record<string, string>>>([])
  const [rows, setRows] = useState<Array<Record<string, string>>>([])
  const [fontSize] = useState(16)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const [headers, setHeaders] = useState<string[]>([])
  const [sourceRows, setSourceRows] = useState<Array<Record<string, string>>>([])

  const colDragRef = useRef<{ header: string; startX: number; startWidth: number } | null>(null)
  const rowDragRef = useRef<{ rowKey: string; startY: number; startHeight: number } | null>(null)

  useEffect(() => {
    function onMouseMove(event: MouseEvent) {
      if (colDragRef.current) {
        const { header, startX, startWidth } = colDragRef.current
        const nextWidth = Math.max(140, startWidth + event.clientX - startX)
        setColumnWidths((prev) => ({ ...prev, [header]: nextWidth }))
        return
      }
      if (rowDragRef.current) {
        const { rowKey, startY, startHeight } = rowDragRef.current
        const nextHeight = Math.max(44, startHeight + event.clientY - startY)
        setRowHeights((prev) => ({ ...prev, [rowKey]: nextHeight }))
      }
    }

    function onMouseUp() {
      colDragRef.current = null
      rowDragRef.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    async function loadExcelFromPublic() {
      setLoading(true)
      try {
        const response = await fetch('/travel-analytics/鏅偣鏅尯鏃呮父鏁版嵁琛屼负鍒嗘瀽鏁版嵁.xlsx')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const buffer = await response.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[firstSheetName]
        if (!sheet) {
          throw new Error('sheet not found')
        }

        const matrix = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          raw: false,
          defval: '',
        })

        const headerRow = (matrix[0] ?? []).map((cell) => String(cell ?? '').trim())
        const normalizedHeaders = headerRow.map((header, index) => (header ? header : `鍒?{index + 1}`))
        const builtRows = matrix
          .slice(1)
          .map((row, rowIndex) => {
            const nextRow: Record<string, string> = { key: String(rowIndex + 1) }
            normalizedHeaders.forEach((header, colIndex) => {
              nextRow[header] = String(row[colIndex] ?? '')
            })
            return nextRow
          })
          .filter((row) => normalizedHeaders.some((header) => (row[header] ?? '').trim() !== ''))

        setHeaders(normalizedHeaders)
        setSourceRows(builtRows)
      } catch {
        message.error('璇诲彇 Excel 澶辫触锛岃妫€鏌ユ枃浠舵槸鍚﹀瓨鍦ㄤ簬 public/travel-analytics 鐩綍')
      } finally {
        setLoading(false)
      }
    }

    void loadExcelFromPublic()
  }, [])

  useEffect(() => {
    const builtColumns: TableColumnsType<Record<string, string>> = headers.map((header) => {
      const width = columnWidths[header] ?? 260
      return {
        title: (
          <div style={{ position: 'relative', paddingRight: 10 }}>
            <span>{header}</span>
            <span
              role="separator"
              style={{
                position: 'absolute',
                right: -6,
                top: 0,
                width: 12,
                height: '100%',
                cursor: 'col-resize',
                zIndex: 2,
              }}
              onMouseDown={(event) => {
                event.preventDefault()
                colDragRef.current = { header, startX: event.clientX, startWidth: width }
                document.body.style.userSelect = 'none'
                document.body.style.cursor = 'col-resize'
              }}
            />
          </div>
        ),
        dataIndex: header,
        key: header,
        width,
        render: (value: string, record: Record<string, string>) => {
          const rowKey = String(record.key ?? '')
          const rowHeight = rowHeights[rowKey] ?? 64
          return renderTruncatedCell(value, rowHeight, fontSize, rowKey, setRowHeightDragStart)
        },
      }
    })

    setColumns(builtColumns)
    setRows(sourceRows)
  }, [headers, sourceRows, columnWidths, rowHeights, fontSize])

  function setRowHeightDragStart(event: React.MouseEvent<HTMLDivElement>, rowKey: string, currentHeight: number) {
    event.preventDefault()
    rowDragRef.current = { rowKey, startY: event.clientY, startHeight: currentHeight }
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }

  return (
    <div className="admin-panel-grid">
      <Card title="鏃呮父鏁版嵁琛屼负鍒嗘瀽">
        <Card size="small" className="admin-build-summary admin-build-summary--muted">
          鍥哄畾灞曠ず鏂囦欢锛歚鏅偣鏅尯鏃呮父鏁版嵁琛屼负鍒嗘瀽鏁版嵁.xlsx`锛堜笌鍘熻〃淇濇寔涓€鑷达紝涓嶅仛瀵煎叆淇敼锛夈€?
        </Card>
        <div style={{ marginTop: 12, color: '#6b7280' }}>
          鍙洿鎺ユ嫋鍔ㄨ〃澶村彸渚ц竟绾胯皟鏁村垪瀹斤紱鎷栧姩鍗曞厓鏍煎簳閮ㄨ竟绾胯皟鏁磋琛岃楂橈紱鎮仠鍗曞厓鏍兼煡鐪嬪畬鏁村唴瀹广€?
        </div>
      </Card>
      <Card title="琛ㄦ牸鏁版嵁">
        <div className="travel-analytics-table-wrap">
          <Table
            columns={columns}
            dataSource={rows}
            loading={loading}
            scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              position: ['bottomLeft'],
            }}
          />
        </div>
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
            helpful: item.helpful ? '鏈夊府鍔? : '寰呬紭鍖?,
            rating: `${item.rating}/5`,
            comment: item.comment || '-',
          }),
        ),
      )
    }

    void loadFeedback()
  }, [])

  return (
    <Card title="娓稿鍙嶉鍒嗘瀽">
      <Table columns={feedbackColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function QaPanel() {
  return (
    <Card title="闂瓟璁板綍鏌ヨ">
      <Form layout="inline" className="admin-filter-row">
        <Form.Item label="鍏抽敭璇?>
          <Input placeholder="鎼滅储闂鍏抽敭璇? />
        </Form.Item>
        <Form.Item label="婊℃剰搴?>
          <Select
            style={{ width: 180 }}
            options={[
              { value: 'all', label: '鍏ㄩ儴' },
              { value: 'good', label: '鏈夊府鍔? },
              { value: 'bad', label: '寰呬紭鍖? },
            ]}
          />
        </Form.Item>
        <Button type="primary">鏌ヨ</Button>
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
    case 'travel-analytics':
      return <TravelAnalyticsPanel />
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
        <h1>绠＄悊鍚庡彴鐧诲綍</h1>
        <p className="lead">
          杩欎竴鐗堝厛瀹屾垚姣旇禌婕旂ず鍚庡彴楠ㄦ灦锛屽寘鎷€昏銆佺煡璇嗗簱銆佹櫙鐐广€佽矾绾裤€佹暟瀛椾汉閰嶇疆銆佸弽棣堝垎鏋愬拰闂瓟鏌ヨ銆?
        </p>
        <div className="account-list">
          <div>
            <span>绠＄悊鍛?/span>
            <strong>admin / admin123</strong>
          </div>
          <div>
            <span>鏅€氱敤鎴?/span>
            <strong>user / user123</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            鐢ㄦ埛鍚?
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            瀵嗙爜
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '鐧诲綍涓?..' : '鐧诲綍'}
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
        title="鏂板鏅偣"
        actionText="鍙戝竷鏅偣"
        onAction={() => { message.success('鍙戝竷鎴愬姛'); setSpotDrawerOpen(false) }}
      />
      <Sider width={248} className="admin-sider">
        <div className="admin-brand">
          <strong>鏁板瓧浜虹鐞嗗悗鍙?/strong>
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
            璁剧疆
          </Button>
        </div>
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div className="admin-header__actions">
            <Tag color="blue">{user.role}</Tag>
            <Button icon={<UserOutlined />} onClick={onLogout}>閫€鍑虹櫥褰?/Button>
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
        setError('褰撳墠鍏ュ彛浠呭厑璁哥鐞嗗憳鐧诲綍锛岃浣跨敤绠＄悊鍛樿处鍙枫€?)
        setUser(null)
        return
      }

      saveUser(response.data)
      setUser(response.data)
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        setError(submitError.response?.data?.message ?? '鐧诲綍澶辫触锛岃妫€鏌ュ悗绔湇鍔″拰璐﹀彿瀵嗙爜銆?)
      } else {
        setError('鐧诲綍澶辫触锛岃绋嶅悗閲嶈瘯銆?)
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



