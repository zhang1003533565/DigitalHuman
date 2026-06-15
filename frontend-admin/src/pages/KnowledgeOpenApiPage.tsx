import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  FileSearchOutlined,
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
    } catch {
      notify('error', 'MaxKB 接入配置加载失败')
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
    } catch {
      notify('error', '知识库列表加载失败')
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
    } catch {
      if (requestSeq !== documentsRequestSeq.current) {
        return
      }
      setDocuments([])
      setDocumentsKnowledgeId('')
      setDocumentTotal(0)
      setSelectedDocumentId('')
      notify('error', '文档列表加载失败')
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
    } catch {
      setParagraphs([])
      setParagraphTotal(0)
      notify('error', '段落加载失败')
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
    } catch {
      notify('error', '召回测试失败')
    } finally {
      setTesting(false)
    }
  }

  async function handleApplyConfig() {
    if (!configAccessUrl.trim()) {
      notify('warning', '请填写 MaxKB 访问地址')
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
    } catch {
      notify('error', '保存 MaxKB 接入配置失败')
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
    { title: '状态', render: (_, record) => <Tag>{textOf(record, ['status', 'task_type', 'state'])}</Tag>, width: 120 },
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
      <Card
        title="MaxKB 接入配置"
        loading={loadingConfig}
        extra={currentConfig?.configured ? <Tag color="green">已配置</Tag> : <Tag>未配置</Tag>}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Form layout="vertical">
              <Form.Item label="访问地址">
                <Input
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
        extra={
          <Space wrap>
            <Tag color="blue">MaxKB OpenAPI</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => void loadKnowledges(selectedKnowledgeId)} loading={loadingKnowledges}>
              刷新
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={9}>
            <Card size="small" title="知识库" extra={<Text type="secondary">{knowledgeTotal} 个</Text>}>
              <Table
                rowKey="key"
                columns={knowledgeColumns}
                dataSource={knowledges}
                loading={loadingKnowledges}
                pagination={false}
                size="small"
                scroll={{ y: 320, x: 1040 }}
                rowClassName={(record) => record.idText === selectedKnowledgeId ? 'admin-table-row-selected' : ''}
                onRow={(record) => ({
                  onClick: () => setSelectedKnowledgeId(record.idText),
                })}
              />
            </Card>
          </Col>
          <Col xs={24} lg={15}>
            <Card
              size="small"
              title={selectedKnowledge ? `文档：${selectedKnowledge.nameText}` : '文档'}
              extra={<Text type="secondary">{documentTotal} 个</Text>}
            >
              <Table
                rowKey="key"
                columns={documentColumns}
                dataSource={documents}
                loading={loadingDocuments}
                pagination={false}
                size="small"
                scroll={{ y: 320, x: 860 }}
                rowClassName={(record) => record.idText === selectedDocumentId ? 'admin-table-row-selected' : ''}
                onRow={(record) => ({
                  onClick: () => setSelectedDocumentId(record.idText),
                })}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card
        title={selectedDocument ? `段落：${selectedDocument.nameText}` : '段落'}
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

      <Card title="召回测试">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Form layout="vertical">
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
              <Input.TextArea rows={4} value={queryText} onChange={(event) => setQueryText(event.target.value)} />
              <Button type="primary" icon={<SearchOutlined />} loading={testing} onClick={() => void handleHitTest()}>
                执行召回
              </Button>
              <Table
                rowKey="key"
                columns={paragraphColumns}
                dataSource={hitResults}
                loading={testing}
                pagination={{ pageSize: 5 }}
                size="small"
                scroll={{ x: 780 }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title="OpenAPI 能力">
        <Table
          rowKey={(record, index) => `${record.method ?? ''}-${record.path ?? record.id ?? index}`}
          dataSource={docs}
          pagination={false}
          size="small"
          columns={[
            { title: '方法', dataIndex: 'method', width: 100, render: (value) => <Tag color="blue">{String(value ?? 'GET')}</Tag> },
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
