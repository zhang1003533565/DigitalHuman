import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { TableColumnsType } from 'antd'
import {
  ApiOutlined,
  BookOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import {
  extractRecords,
  extractTotal,
  getDocumentParagraphs,
  getKnowledgeDocuments,
  getKnowledgeOpenApiDocs,
  getKnowledges,
  getKnowledgeOpenApiConfig,
  runKnowledgeHitTest,
  saveKnowledgeOpenApiConfig,
  type MaxKbOpenApiConfig,
  type MaxKbRecord,
} from '../api/knowledgeOpenApi'

type KnowledgeRow = MaxKbRecord & { key: string; idText: string; nameText: string }
type DocumentRow = MaxKbRecord & { key: string; idText: string; nameText: string }
type ParagraphRow = MaxKbRecord & { key: string; idText: string; contentText: string }
type NoticeState = { type: 'success' | 'info' | 'warning' | 'error'; text: string } | null

const { Text, Paragraph } = Typography
const ACCESS_KEY_HINT = '请检验地址和key是否正确'

function isSpringDefaultErrorBody(data: unknown): boolean {
  if (!data || typeof data !== 'object') {
    return false
  }
  const record = data as Record<string, unknown>
  const hasTimestamp = typeof record.timestamp === 'string' || typeof record.timestamp === 'number'
  const hasPath = typeof record.path === 'string'
  const hasStatus = typeof record.status === 'number'
  const hasOnlyFrameworkKeys =
    Object.keys(record).every((key) =>
      ['timestamp', 'status', 'error', 'path', 'trace', 'exception', 'requestId'].includes(key))
  return hasOnlyFrameworkKeys && (hasTimestamp || hasPath) && hasStatus
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return '请求参数有误，请检查后再试'
    case 401:
      return '登录已失效或未登录，请重新登录'
    case 403:
      return '当前账号无权限操作，请联系管理员'
    case 404:
      return '请求的资源不存在或已删除'
    case 405:
      return '请求方式不被支持'
    case 408:
      return '请求超时，请稍后重试'
    case 409:
      return '数据冲突，记录可能已存在'
    case 413:
      return '上传内容过大'
    case 415:
      return '不支持的请求格式'
    case 429:
      return '请求过于频繁，请稍后再试'
    case 500:
      return '服务器内部错误，请稍后重试'
    case 502:
      return '上游服务不可用，请检查 MaxKB 是否启动'
    case 503:
      return '服务暂不可用，请稍后重试'
    case 504:
      return '上游服务响应超时'
    default:
      if (status >= 500) {
        return '服务器异常，请稍后重试'
      }
      if (status >= 400) {
        return '请求未能完成，请稍后重试'
      }
      return `请求失败（HTTP ${status}）`
  }
}

function truncate(value: string, max = 200): string {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= max) {
    return collapsed
  }
  return `${collapsed.slice(0, max)}…`
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

function translateKnownError(value: string, status?: number): string {
  const raw = value.trim()
  const parsed = parseJsonRecord(raw)
  const code = parsed?.code
  const message = typeof parsed?.message === 'string' ? parsed.message : raw
  const lowerMessage = message.toLowerCase()

  if (code === 1002 || lowerMessage.includes('invalid access token')) {
    return ACCESS_KEY_HINT
  }
  if (status === 401 || lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
    return ACCESS_KEY_HINT
  }
  if (status === 403 || lowerMessage.includes('permission') || lowerMessage.includes('forbidden')) {
    return ACCESS_KEY_HINT
  }
  if (lowerMessage.includes('not found')) {
    return 'MaxKB 资源不存在，请检查工作空间、知识库或文档 ID 是否正确'
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return 'MaxKB 响应超时，请稍后重试'
  }

  if (parsed) {
    if (typeof code === 'number' || typeof code === 'string') {
      return `MaxKB 返回错误，错误码：${code}`
    }
    return status ? friendlyStatusMessage(status) : 'MaxKB 返回异常响应，请检查接口配置'
  }

  return truncate(raw)
}

function getAccessUrlProblem(value: string): string {
  const accessUrl = value.trim()
  if (!accessUrl) {
    return ACCESS_KEY_HINT
  }

  let url: URL
  try {
    url = new URL(accessUrl)
  } catch {
    return ACCESS_KEY_HINT
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return ACCESS_KEY_HINT
  }

  const workspacePrefix = '/openapi/knowledge/v1/workspaces/'
  const normalizedPath = url.pathname.replace(/\/+$/, '')
  const prefixIndex = normalizedPath.indexOf(workspacePrefix)
  const workspaceId = prefixIndex >= 0 ? normalizedPath.slice(prefixIndex + workspacePrefix.length).trim() : ''
  if (prefixIndex < 0 || !workspaceId || workspaceId.includes('/')) {
    return ACCESS_KEY_HINT
  }

  return ''
}

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    const data = error.response?.data

    if (typeof data === 'string' && data.trim()) {
      return translateKnownError(data, status)
    }

    if (data && typeof data === 'object' && !isSpringDefaultErrorBody(data)) {
      const record = data as { message?: unknown; detail?: unknown; error?: unknown; msg?: unknown }
      const candidates = [record.message, record.detail, record.msg, record.error]
      for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          return translateKnownError(candidate, status)
        }
      }
    }

    if (status) {
      return friendlyStatusMessage(status)
    }

    if (error.code === 'ERR_NETWORK') {
      return '无法连接到后端服务，请确认 backend-java 已启动'
    }
    if (error.code) {
      return `网络错误：${error.code}`
    }
    if (error.message) {
      return error.message
    }
    return '未知网络错误'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'string' && error.trim()) {
    return error
  }
  return '未知错误'
}

function textOf(record: MaxKbRecord, keys: string[], fallback = '-') {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
  }
  return fallback
}

function shortText(value: unknown, max = 120) {
  const text = typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value)
  if (text.length <= max) {
    return text || '-'
  }
  return `${text.slice(0, max)}...`
}

function documentStatus(record: DocumentRow) {
  const rawValue =
    record.is_active ??
    record.enabled ??
    record.state ??
    record.sync_status ??
    record.index_status ??
    record.embedding_status

  if (rawValue == null || rawValue === '') {
    return { text: '-', color: undefined }
  }

  if (typeof rawValue === 'boolean') {
    return rawValue
      ? { text: '启用', color: 'success' }
      : { text: '停用', color: 'default' }
  }

  const normalized = String(rawValue).trim().toLowerCase()
  const knownStatuses: Record<string, { text: string; color?: string }> = {
    '0': { text: '停用', color: 'default' },
    '1': { text: '启用', color: 'success' },
    '2': { text: '处理中', color: 'processing' },
    '3': { text: '完成', color: 'success' },
    '4': { text: '失败', color: 'error' },
    active: { text: '启用', color: 'success' },
    enable: { text: '启用', color: 'success' },
    enabled: { text: '启用', color: 'success' },
    true: { text: '启用', color: 'success' },
    inactive: { text: '停用', color: 'default' },
    disable: { text: '停用', color: 'default' },
    disabled: { text: '停用', color: 'default' },
    false: { text: '停用', color: 'default' },
    ready: { text: '完成', color: 'success' },
    success: { text: '完成', color: 'success' },
    successful: { text: '完成', color: 'success' },
    completed: { text: '完成', color: 'success' },
    complete: { text: '完成', color: 'success' },
    done: { text: '完成', color: 'success' },
    processing: { text: '处理中', color: 'processing' },
    running: { text: '处理中', color: 'processing' },
    pending: { text: '等待中', color: 'warning' },
    waiting: { text: '等待中', color: 'warning' },
    failed: { text: '失败', color: 'error' },
    fail: { text: '失败', color: 'error' },
    error: { text: '失败', color: 'error' },
    启用: { text: '启用', color: 'success' },
    已启用: { text: '启用', color: 'success' },
    停用: { text: '停用', color: 'default' },
    已停用: { text: '停用', color: 'default' },
    禁用: { text: '停用', color: 'default' },
    处理中: { text: '处理中', color: 'processing' },
    解析中: { text: '处理中', color: 'processing' },
    向量化中: { text: '处理中', color: 'processing' },
    等待中: { text: '等待中', color: 'warning' },
    完成: { text: '完成', color: 'success' },
    已完成: { text: '完成', color: 'success' },
    成功: { text: '完成', color: 'success' },
    失败: { text: '失败', color: 'error' },
  }

  return knownStatuses[normalized] ?? { text: String(rawValue).trim(), color: 'default' }
}

function makeRows(records: MaxKbRecord[], type: 'knowledge' | 'document' | 'paragraph') {
  return records.map((record, index) => {
    const idText = textOf(record, ['id', 'knowledge_id', 'document_id', 'paragraph_id'], String(index + 1))
    const nameText = textOf(record, ['name', 'document_name', 'knowledge_name', 'title'], idText)
    const contentText = textOf(record, ['content', 'desc', 'description'], '')
    return { ...record, key: `${type}-${idText}-${index}`, idText, nameText, contentText }
  })
}

export default function KnowledgeOpenApiPage() {
  const [loadingKnowledges, setLoadingKnowledges] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingParagraphs, setLoadingParagraphs] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [testing, setTesting] = useState(false)
  const [notice, setNotice] = useState<NoticeState>(null)
  const [currentConfig, setCurrentConfig] = useState<MaxKbOpenApiConfig | null>(null)
  const [configAccessUrl, setConfigAccessUrl] = useState('http://localhost:3000/openapi/knowledge/v1/workspaces/default')
  const [configApiKey, setConfigApiKey] = useState('')
  const [configDefaultKnowledgeId, setConfigDefaultKnowledgeId] = useState('')
  const [knowledges, setKnowledges] = useState<KnowledgeRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [documentsKnowledgeId, setDocumentsKnowledgeId] = useState('')
  const [paragraphs, setParagraphs] = useState<ParagraphRow[]>([])
  const [hitResults, setHitResults] = useState<ParagraphRow[]>([])
  const [docs, setDocs] = useState<MaxKbRecord[]>([])
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [detailRecord, setDetailRecord] = useState<MaxKbRecord | null>(null)
  const [knowledgeTotal, setKnowledgeTotal] = useState(0)
  const [documentTotal, setDocumentTotal] = useState(0)
  const [paragraphTotal, setParagraphTotal] = useState(0)
  const [queryText, setQueryText] = useState('灵山大佛有什么看点？')
  const [topNumber, setTopNumber] = useState(5)
  const [similarity, setSimilarity] = useState(0.6)
  const [searchMode, setSearchMode] = useState<'embedding' | 'keywords' | 'blend'>('blend')
  const documentsRequestSeq = useRef(0)
  const configAccessUrlRef = useRef(configAccessUrl)

  useEffect(() => {
    configAccessUrlRef.current = configAccessUrl
  }, [configAccessUrl])

  function notify(type: NonNullable<NoticeState>['type'], text: string) {
    setNotice({ type, text })
  }

  const loadConfig = useCallback(async () => {
    setLoadingConfig(true)
    try {
      const payload = await getKnowledgeOpenApiConfig()
      setCurrentConfig(payload)
      setConfigAccessUrl(payload.accessUrl || 'http://localhost:3000/openapi/knowledge/v1/workspaces/default')
      setConfigApiKey(payload.apiKey || '')
      setConfigDefaultKnowledgeId(payload.defaultKnowledgeId || '')
    } catch (error) {
      notify('error', `MaxKB 接入配置加载失败：${extractErrorMessage(error)}`)
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  const loadDocs = useCallback(async () => {
    try {
      const payload = await getKnowledgeOpenApiDocs()
      const nestedEndpoints = (payload as { data?: { endpoints?: unknown[] } }).data?.endpoints
      setDocs(extractRecords(nestedEndpoints ?? payload))
    } catch {
      setDocs([])
    }
  }, [])

  const loadKnowledges = useCallback(async (preferredKnowledgeId = '') => {
    setLoadingKnowledges(true)
    try {
      const payload = await getKnowledges({ page: 1, size: 100 })
      const records = extractRecords(payload)
      const rows = makeRows(records, 'knowledge') as KnowledgeRow[]
      setKnowledges(rows)
      setKnowledgeTotal(extractTotal(payload, rows.length))
      setSelectedKnowledgeId((currentId) => {
        const candidateId = preferredKnowledgeId || currentId
        if (candidateId && rows.some((item) => item.idText === candidateId)) {
          return candidateId
        }
        return rows[0]?.idText ?? ''
      })
    } catch (error) {
      const accessUrlProblem = getAccessUrlProblem(configAccessUrlRef.current)
      notify('error', `知识库列表加载失败：${accessUrlProblem || extractErrorMessage(error)}`)
    } finally {
      setLoadingKnowledges(false)
    }
  }, [])

  const loadDocuments = useCallback(async (knowledgeId: string) => {
    const requestSeq = ++documentsRequestSeq.current
    setSelectedDocumentId('')
    setDocuments([])
    setDocumentsKnowledgeId('')
    setParagraphs([])
    setDocumentTotal(0)
    setParagraphTotal(0)
    if (!knowledgeId) {
      return
    }
    setLoadingDocuments(true)
    try {
      const payload = await getKnowledgeDocuments(knowledgeId, { current_page: 1, page_size: 100, task_type: 1 })
      if (requestSeq !== documentsRequestSeq.current) {
        return
      }
      const records = extractRecords(payload)
      const rows = makeRows(records, 'document') as DocumentRow[]
      setDocuments(rows)
      setDocumentsKnowledgeId(knowledgeId)
      setDocumentTotal(extractTotal(payload, rows.length))
      setSelectedDocumentId(rows[0]?.idText ?? '')
    } catch (error) {
      if (requestSeq !== documentsRequestSeq.current) {
        return
      }
      setDocuments([])
      setDocumentsKnowledgeId('')
      setDocumentTotal(0)
      setSelectedDocumentId('')
      const accessUrlProblem = getAccessUrlProblem(configAccessUrlRef.current)
      notify('error', `文档列表加载失败：${accessUrlProblem || extractErrorMessage(error)}`)
    } finally {
      if (requestSeq === documentsRequestSeq.current) {
        setLoadingDocuments(false)
      }
    }
  }, [])

  const loadParagraphs = useCallback(async (knowledgeId: string, documentId: string) => {
    if (!knowledgeId || !documentId) {
      return
    }
    setLoadingParagraphs(true)
    try {
      const payload = await getDocumentParagraphs(knowledgeId, documentId, { page: 1, size: 100 })
      const records = extractRecords(payload)
      const rows = makeRows(records, 'paragraph') as ParagraphRow[]
      setParagraphs(rows)
      setParagraphTotal(extractTotal(payload, rows.length))
    } catch (error) {
      setParagraphs([])
      setParagraphTotal(0)
      const accessUrlProblem = getAccessUrlProblem(configAccessUrlRef.current)
      notify('error', `段落加载失败：${accessUrlProblem || extractErrorMessage(error)}`)
    } finally {
      setLoadingParagraphs(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadConfig()
      void loadDocs()
      void loadKnowledges()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadConfig, loadDocs, loadKnowledges])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadDocuments(selectedKnowledgeId)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadDocuments, selectedKnowledgeId])

  useEffect(() => {
    if (!selectedDocumentId) {
      return
    }
    if (documentsKnowledgeId !== selectedKnowledgeId) {
      return
    }
    if (!documents.some((item) => item.idText === selectedDocumentId)) {
      return
    }
    const timeoutId = window.setTimeout(() => {
      void loadParagraphs(selectedKnowledgeId, selectedDocumentId)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [documents, documentsKnowledgeId, loadParagraphs, selectedDocumentId, selectedKnowledgeId])

  async function handleHitTest() {
    if (!selectedKnowledgeId) {
      notify('warning', '请先选择知识库')
      return
    }
    if (!queryText.trim()) {
      notify('warning', '请输入召回测试问题')
      return
    }
    setTesting(true)
    try {
      const payload = await runKnowledgeHitTest({
        knowledge_id: selectedKnowledgeId,
        query_text: queryText.trim(),
        top_number: topNumber,
        similarity,
        search_mode: searchMode,
      })
      setHitResults(makeRows(extractRecords(payload), 'paragraph') as ParagraphRow[])
      notify('success', '召回测试完成')
    } catch (error) {
      const accessUrlProblem = getAccessUrlProblem(configAccessUrlRef.current)
      notify('error', `召回测试失败：${accessUrlProblem || extractErrorMessage(error)}`)
    } finally {
      setTesting(false)
    }
  }

  async function handleApplyConfig() {
    const accessUrlProblem = getAccessUrlProblem(configAccessUrl)
    if (accessUrlProblem) {
      notify('warning', accessUrlProblem)
      return
    }
    if (!configApiKey.trim()) {
      notify('warning', '请填写 API Key')
      return
    }
    setSavingConfig(true)
    try {
      const payload = await saveKnowledgeOpenApiConfig({
        accessUrl: configAccessUrl.trim(),
        apiKey: configApiKey.trim(),
        defaultKnowledgeId: configDefaultKnowledgeId.trim(),
      })
      setCurrentConfig(payload)
      setConfigAccessUrl(payload.accessUrl || configAccessUrl)
      setConfigApiKey(payload.apiKey || configApiKey)
      setConfigDefaultKnowledgeId(payload.defaultKnowledgeId || configDefaultKnowledgeId)
      setSelectedKnowledgeId('')
      setSelectedDocumentId('')
      setDocuments([])
      setDocumentsKnowledgeId('')
      setParagraphs([])
      notify('success', 'MaxKB 接入配置已应用')
      await loadKnowledges()
    } catch (error) {
      const accessUrlProblem = getAccessUrlProblem(configAccessUrlRef.current)
      notify('error', `保存 MaxKB 接入配置失败：${accessUrlProblem || extractErrorMessage(error)}`)
    } finally {
      setSavingConfig(false)
    }
  }

  const knowledgeColumns: TableColumnsType<KnowledgeRow> = useMemo(() => [
    { title: '知识库', dataIndex: 'nameText', width: 180, ellipsis: true },
    {
      title: 'ID',
      dataIndex: 'idText',
      width: 340,
      render: (value) => <Text className="admin-mono-cell">{String(value ?? '-')}</Text>,
    },
    { title: '描述', render: (_, record) => shortText(record.desc ?? record.description, 80), ellipsis: true },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button type="link" onClick={() => setDetailRecord(record)}>详情</Button>
      ),
    },
  ], [])

  const documentColumns: TableColumnsType<DocumentRow> = useMemo(() => [
    { title: '文档', dataIndex: 'nameText', width: 220, ellipsis: true },
    {
      title: 'ID',
      dataIndex: 'idText',
      width: 340,
      render: (value) => <Text className="admin-mono-cell">{String(value ?? '-')}</Text>,
    },
    {
      title: '状态',
      render: (_, record) => {
        const status = documentStatus(record)
        return <Tag color={status.color}>{status.text}</Tag>
      },
      width: 120,
    },
    { title: '更新时间', render: (_, record) => textOf(record, ['update_time', 'updated_at', 'create_time']), width: 180 },
  ], [])

  const paragraphColumns: TableColumnsType<ParagraphRow> = useMemo(() => [
    { title: '标题', render: (_, record) => textOf(record, ['title', 'document_name'], '-'), width: 180, ellipsis: true },
    { title: '内容', dataIndex: 'contentText', ellipsis: true },
    { title: '相似度', render: (_, record) => shortText(record.similarity ?? record.comprehensive_score, 20), width: 110 },
  ], [])

  const selectedKnowledge = knowledges.find((item) => item.idText === selectedKnowledgeId)
  const selectedDocument = documents.find((item) => item.idText === selectedDocumentId)

  return (
    <div className="admin-panel-grid knowledge-openapi-page">
      <section className="knowledge-openapi-hero">
        <div className="knowledge-openapi-hero__copy">
          <div className="knowledge-openapi-hero__eyebrow">
            <BookOutlined />
            <span>Knowledge Gateway</span>
          </div>
          <h1>知识库对接站</h1>
          <p>统一管理 MaxKB OpenAPI 接入、知识库内容巡检与召回测试。</p>
        </div>
        <div className="knowledge-openapi-hero__stats" aria-label="知识库状态概览">
          <div className="knowledge-stat-tile">
            <span>接入状态</span>
            <strong>{currentConfig?.configured ? '已配置' : '待配置'}</strong>
          </div>
          <div className="knowledge-stat-tile">
            <span>知识库</span>
            <strong>{knowledgeTotal}</strong>
          </div>
          <div className="knowledge-stat-tile">
            <span>文档</span>
            <strong>{documentTotal}</strong>
          </div>
          <div className="knowledge-stat-tile">
            <span>段落</span>
            <strong>{paragraphTotal}</strong>
          </div>
        </div>
      </section>

      <Card
        title="MaxKB 接入配置"
        className="knowledge-card knowledge-card--config"
        loading={loadingConfig}
        extra={currentConfig?.configured ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>}
      >
        <Row gutter={[18, 16]}>
          <Col xs={24} lg={14}>
            <Form layout="vertical">
              <Form.Item label="访问地址">
                <Input
                  prefix={<LinkOutlined />}
                  value={configAccessUrl}
                  onChange={(event) => setConfigAccessUrl(event.target.value)}
                  placeholder="http://localhost:3000/openapi/knowledge/v1/workspaces/default"
                />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} lg={10}>
            <Form layout="vertical">
              <Form.Item label="API Key">
                <Input.Password
                  value={configApiKey}
                  onChange={(event) => setConfigApiKey(event.target.value)}
                  placeholder="mkb_xxx"
                />
              </Form.Item>
            </Form>
          </Col>
        </Row>
        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} lg={10}>
            <Form layout="vertical">
              <Form.Item label="默认知识库 ID">
                <Input
                  prefix={<DatabaseOutlined />}
                  value={configDefaultKnowledgeId}
                  onChange={(event) => setConfigDefaultKnowledgeId(event.target.value)}
                  placeholder="可选，用于游客问答默认召回"
                />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} lg={14}>
            <Space wrap>
              <Button type="primary" onClick={() => void handleApplyConfig()} loading={savingConfig}>
                应用配置
              </Button>
              <Button onClick={() => void loadKnowledges(selectedKnowledgeId)} loading={loadingKnowledges}>
                测试读取知识库
              </Button>
              {currentConfig?.workspaceId ? <Tag color="blue">工作空间：{currentConfig.workspaceId}</Tag> : null}
            </Space>
          </Col>
        </Row>
      </Card>

      {notice ? (
        <Alert
          type={notice.type}
          message={notice.text}
          showIcon
          closable={{
            closeIcon: true,
            onClose: () => setNotice(null),
          }}
        />
      ) : null}

      <Card
        title="知识库管理"
        className="knowledge-card knowledge-card--browser"
        extra={
          <Space wrap>
            <Tag color="blue">MaxKB OpenAPI</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => void loadKnowledges(selectedKnowledgeId)} loading={loadingKnowledges}>
              刷新
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]} className="knowledge-browser-grid">
          <Col xs={24} lg={9}>
            <section className="knowledge-browser-panel">
              <div className="knowledge-panel-heading">
                <span><DatabaseOutlined />知识库</span>
                <Text type="secondary">{knowledgeTotal} 个</Text>
              </div>
              <Table
                rowKey="key"
                columns={knowledgeColumns}
                dataSource={knowledges}
                className="knowledge-table"
                loading={loadingKnowledges}
                pagination={false}
                size="small"
                scroll={{ y: 320, x: 1040 }}
                rowClassName={(record) => record.idText === selectedKnowledgeId ? 'admin-table-row-selected' : ''}
                onRow={(record) => ({
                  onClick: () => setSelectedKnowledgeId(record.idText),
                })}
              />
            </section>
          </Col>
          <Col xs={24} lg={15}>
            <section className="knowledge-browser-panel">
              <div className="knowledge-panel-heading">
                <span><FileTextOutlined />{selectedKnowledge ? `文档：${selectedKnowledge.nameText}` : '文档'}</span>
                <Text type="secondary">{documentTotal} 个</Text>
              </div>
              <Table
                rowKey="key"
                columns={documentColumns}
                dataSource={documents}
                className="knowledge-table"
                loading={loadingDocuments}
                pagination={false}
                size="small"
                scroll={{ y: 320, x: 860 }}
                rowClassName={(record) => record.idText === selectedDocumentId ? 'admin-table-row-selected' : ''}
                onRow={(record) => ({
                  onClick: () => setSelectedDocumentId(record.idText),
                })}
              />
            </section>
          </Col>
        </Row>
      </Card>

      <Card
        title={selectedDocument ? `段落：${selectedDocument.nameText}` : '段落'}
        className="knowledge-card knowledge-card--paragraphs"
        extra={
          <Button icon={<FileSearchOutlined />} onClick={() => void loadParagraphs(selectedKnowledgeId, selectedDocumentId)} disabled={!selectedDocumentId} loading={loadingParagraphs}>
            查看段落
          </Button>
        }
      >
        {selectedDocumentId ? (
          <Table
            rowKey="key"
            columns={paragraphColumns}
            dataSource={paragraphs}
            className="knowledge-table"
            loading={loadingParagraphs}
            pagination={{ pageSize: 6 }}
            size="small"
            scroll={{ x: 780 }}
          />
        ) : (
          <Empty description="请选择一个文档" />
        )}
        <Text type="secondary">共 {paragraphTotal} 个段落</Text>
      </Card>

      <Card title="召回测试" className="knowledge-card knowledge-card--hit-test">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Form layout="vertical" className="knowledge-hit-test-form">
              <Form.Item label="知识库">
                <Select
                  value={selectedKnowledgeId || undefined}
                  options={knowledges.map((item) => ({ value: item.idText, label: item.nameText }))}
                  onChange={setSelectedKnowledgeId}
                  placeholder="请选择知识库"
                  showSearch
                  optionFilterProp="label"
                />
              </Form.Item>
              <Form.Item label="检索模式">
                <Select
                  value={searchMode}
                  onChange={setSearchMode}
                  options={[
                    { value: 'blend', label: '混合检索' },
                    { value: 'embedding', label: '向量检索' },
                    { value: 'keywords', label: '关键词检索' },
                  ]}
                />
              </Form.Item>
              <Form.Item label="Top N">
                <InputNumber min={1} max={50} value={topNumber} onChange={(value) => setTopNumber(Number(value ?? 5))} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="相似度阈值">
                <InputNumber min={0} max={2} step={0.05} value={similarity} onChange={(value) => setSimilarity(Number(value ?? 0.6))} style={{ width: '100%' }} />
              </Form.Item>
            </Form>
          </Col>
          <Col xs={24} lg={16}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div className="knowledge-query-box">
                <Input.TextArea rows={4} value={queryText} onChange={(event) => setQueryText(event.target.value)} />
                <Button type="primary" icon={<SearchOutlined />} loading={testing} onClick={() => void handleHitTest()}>
                  执行召回
                </Button>
              </div>
              <Table
                rowKey="key"
                columns={paragraphColumns}
                dataSource={hitResults}
                className="knowledge-table"
                loading={testing}
                pagination={{ pageSize: 5 }}
                size="small"
                scroll={{ x: 780 }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="OpenAPI 能力" className="knowledge-card knowledge-card--api">
        <Table
          rowKey={(record, index) => `${record.method ?? ''}-${record.path ?? record.id ?? index}`}
          dataSource={docs}
          className="knowledge-table"
          pagination={false}
          size="small"
          columns={[
            { title: '方法', dataIndex: 'method', width: 100, render: (value) => <Tag color="blue" icon={<ApiOutlined />}>{String(value ?? 'GET')}</Tag> },
            { title: '路径', dataIndex: 'path', ellipsis: true, render: (value) => shortText(value, 180) },
            { title: '说明', dataIndex: 'description', ellipsis: true, render: (value) => shortText(value, 180) },
          ]}
        />
      </Card>

      <Drawer title="原始数据" width={720} open={Boolean(detailRecord)} onClose={() => setDetailRecord(null)}>
        {detailRecord ? (
          <Descriptions column={1} bordered size="small">
            {Object.entries(detailRecord).map(([key, value]) => (
              <Descriptions.Item key={key} label={key}>
                <Paragraph copyable style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </Paragraph>
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : null}
      </Drawer>
    </div>
  )
}
