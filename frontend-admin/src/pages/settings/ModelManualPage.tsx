import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { AutoComplete, Button, Card, Form, Input, Select, Table, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { useDeferredMount } from '../../hooks/useDeferredMount'

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

type ModelCatalogRow = {
  key: string
  category: ModelCategory
  provider: string
  modelId: string
}

type ModelManualPageProps = {
  onCatalogChange?: (catalog: AdminModelCatalog) => void
  onProviderConfigsChange?: (providers: ProviderConfig[]) => void
}

const PROVIDER_OPTIONS = [
  { value: 'DeepSeek', label: 'DeepSeek' },
  { value: 'Qwen', label: 'Qwen' },
  { value: 'Volcengine', label: 'Volcengine' },
  { value: 'Xunfei', label: 'Xunfei' },
]

const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; protocol: string }> = {
  DeepSeek: {
    baseUrl: 'https://api.deepseek.com',
    protocol: 'openai_compatible',
  },
  Qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    protocol: 'openai_compatible',
  },
  Volcengine: {
    baseUrl: '',
    protocol: 'custom',
  },
  Xunfei: {
    baseUrl: '',
    protocol: 'custom',
  },
}

const MODEL_CATEGORY_OPTIONS = [
  { value: 'embedding', label: '嵌入模型' },
  { value: 'speech', label: '语音音色' },
  { value: 'vision', label: '视觉模型' },
  { value: 'chat', label: '对话模型' },
  { value: 'multimodal', label: '多模态模型' },
] as const

function renderMarkdown(markdown: string) {
  const lines = markdown.split('\n')
  const elements: React.JSX.Element[] = []
  let listItems: string[] = []
  let paragraphLines: string[] = []

  const flushList = () => {
    if (!listItems.length) return
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
    if (!paragraphLines.length) return
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

export default function ModelManualPage({ onCatalogChange, onProviderConfigsChange }: ModelManualPageProps) {
  const [addOptionForm] = Form.useForm<AddModelOptionForm>()
  const [providerForm] = Form.useForm<ProviderConfigForm>()
  const [savingProvider, setSavingProvider] = useState(false)
  const [addingOption, setAddingOption] = useState(false)
  const [deletingProvider, setDeletingProvider] = useState<string | null>(null)
  const [deletingOption, setDeletingOption] = useState<string | null>(null)
  const [providerDocSelection, setProviderDocSelection] = useState('DeepSeek')
  const [providerDoc, setProviderDoc] = useState<ProviderDoc | null>(null)
  const [providerDocLoading, setProviderDocLoading] = useState(false)
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([])
  const [catalog, setCatalog] = useState<AdminModelCatalog>({
    embeddingModels: [],
    speechModels: [],
    visionModels: [],
    chatModels: [],
    multimodalModels: [],
  })

  async function loadPage() {
    const [catalogResponse, providerResponse] = await Promise.all([
      axios.get<AdminModelCatalog>('/api/admin/settings/model-options'),
      axios.get<ProviderConfig[]>('/api/admin/settings/providers'),
    ])
    setCatalog(catalogResponse.data)
    setProviderConfigs(providerResponse.data)
    onCatalogChange?.(catalogResponse.data)
    onProviderConfigsChange?.(providerResponse.data)
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
  }

  useDeferredMount(() => {
    void loadPage().catch(() => {
      message.error('手动维护页面加载失败，请检查后端服务。')
    })
  })

  useEffect(() => {
    async function loadProviderDoc() {
      setProviderDocLoading(true)
      try {
        const response = await axios.get<ProviderDoc>(`/api/admin/settings/provider-docs/${providerDocSelection}`)
        setProviderDoc(response.data)
      } catch {
        setProviderDoc(null)
      } finally {
        setProviderDocLoading(false)
      }
    }

    void loadProviderDoc()
  }, [providerDocSelection])

  const catalogRows = useMemo<ModelCatalogRow[]>(() => {
    const rows: ModelCatalogRow[] = []
    const pushRows = (items: AdminModelOption[], category: ModelCategory) => {
      items.forEach((item) => {
        rows.push({
          key: `${category}:${item.provider}:${item.modelId}`,
          category,
          provider: item.provider,
          modelId: item.modelId,
        })
      })
    }

    pushRows(catalog.embeddingModels, 'embedding')
    pushRows(catalog.speechModels, 'speech')
    pushRows(catalog.visionModels, 'vision')
    pushRows(catalog.chatModels, 'chat')
    pushRows(catalog.multimodalModels, 'multimodal')
    return rows
  }, [catalog])

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

  const handleSaveProvider = async (values: ProviderConfigForm) => {
    setSavingProvider(true)
    try {
      const response = await axios.put<ProviderConfig>('/api/admin/settings/providers', values)
      setProviderConfigs((current) => {
        const next = current.filter((item) => item.provider !== response.data.provider)
        const sorted = [...next, response.data].sort((left, right) => left.provider.localeCompare(right.provider))
        onProviderConfigsChange?.(sorted)
        return sorted
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

  const handleDeleteProvider = async (provider: string) => {
    setDeletingProvider(provider)
    try {
      await axios.post('/api/admin/settings/providers/delete', { provider })
      setProviderConfigs((current) => {
        const next = current.filter((item) => item.provider !== provider)
        onProviderConfigsChange?.(next)
        return next
      })
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

  const handleAddOption = async (values: AddModelOptionForm) => {
    setAddingOption(true)
    try {
      const response = await axios.post<AdminModelCatalog>('/api/admin/settings/model-options', values)
      setCatalog(response.data)
      onCatalogChange?.(response.data)
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

  const handleDeleteOption = async (row: ModelCatalogRow) => {
    setDeletingOption(row.key)
    try {
      const response = await axios.post<AdminModelCatalog>('/api/admin/settings/model-options/delete', {
        category: row.category,
        provider: row.provider,
        modelId: row.modelId,
      })
      setCatalog(response.data)
      onCatalogChange?.(response.data)
      message.success(`已删除模型 ${row.modelId}`)
    } catch (error) {
      const description = axios.isAxiosError(error)
        ? error.response?.data?.message ?? '删除模型失败，请检查后端服务。'
        : '删除模型失败，请稍后重试。'
      message.error(description)
    } finally {
      setDeletingOption(null)
    }
  }

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
          <Button size="small" onClick={() => handleEditProvider(row)}>编辑</Button>
          <Button size="small" danger onClick={() => void handleDeleteProvider(row.provider)} loading={deletingProvider === row.provider}>删除</Button>
        </div>
      ),
    },
  ]

  const catalogColumns: TableColumnsType<ModelCatalogRow> = [
    {
      title: '分类',
      dataIndex: 'category',
      render: (value: ModelCategory) => MODEL_CATEGORY_OPTIONS.find((item) => item.value === value)?.label ?? value,
    },
    { title: '提供方', dataIndex: 'provider' },
    { title: '模型 ID', dataIndex: 'modelId' },
    {
      title: '操作',
      key: 'actions',
      render: (_, row) => (
        <Button size="small" danger loading={deletingOption === row.key} onClick={() => void handleDeleteOption(row)}>
          删除
        </Button>
      ),
    },
  ]

  return (
    <div className="admin-panel-grid">
      <Card title="手动维护" className="admin-settings-card">
        <div className="admin-form-grid">
          <Card size="small" className="admin-build-summary">
            模型列表改为手动维护。按分类逐个添加模型提供方和模型 ID，更适合逐步扩展 provider 能力文件。
          </Card>
          <div className="admin-two-column">
            <Card size="small" title="模型能力与支持模型" className="admin-build-summary">
              <div className="admin-provider-docs">
                <div className="admin-provider-docs__toolbar">
                  <Select
                    value={providerDocSelection}
                    options={[
                      { value: 'DeepSeek', label: 'DeepSeek' },
                      { value: 'Qwen', label: 'Qwen' },
                      { value: 'Volcengine', label: 'Volcengine' },
                      { value: 'Xunfei', label: 'Xunfei' },
                      { value: 'Local TTS', label: 'Local TTS / edge-tts' },
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
              <Form form={providerForm} layout="vertical" onFinish={(values) => void handleSaveProvider(values)}>
                <Form.Item label="提供方" name="provider" rules={[{ required: true, message: '请输入模型提供方' }]}>
                  <AutoComplete options={PROVIDER_OPTIONS} onSelect={(value) => handleProviderDraftChange(value)}>
                    <Input placeholder="例如：DeepSeek / Qwen / Volcengine / Xunfei" />
                  </AutoComplete>
                </Form.Item>
                <Form.Item label="Base URL" name="baseUrl" rules={[{ required: true, message: '请输入 Base URL' }]}>
                  <Input placeholder="例如：https://api.deepseek.com" />
                </Form.Item>
                <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入 API Key' }]}>
                  <Input.Password placeholder="请输入该提供方的 API Key" />
                </Form.Item>
                <Form.Item label="协议" name="protocol" rules={[{ required: true, message: '请选择协议' }]}>
                  <Select options={[
                    { value: 'openai_compatible', label: '兼容 OpenAI 协议' },
                    { value: 'custom', label: '自定义协议' },
                  ]} />
                </Form.Item>
                <div className="admin-action-row">
                  <Button type="primary" htmlType="submit" loading={savingProvider}>保存提供方</Button>
                </div>
              </Form>
            </Card>
          </div>
          <div className="admin-two-column">
            <Card size="small" title="新增模型" className="admin-build-summary">
              <Form form={addOptionForm} layout="vertical" onFinish={(values) => void handleAddOption(values)}>
                <Form.Item label="模型分类" name="category" rules={[{ required: true, message: '请选择模型分类' }]}>
                  <Select options={MODEL_CATEGORY_OPTIONS as unknown as { value: string; label: string }[]} />
                </Form.Item>
                <Form.Item
                  label="模型提供方"
                  name="provider"
                  rules={[{ required: true, message: '请选择已配置的模型提供方' }]}
                  extra="请先在右侧保存提供方的 Base URL 和 API Key，再选择该提供方添加模型。"
                >
                  <Select options={providerConfigs.map((item) => ({ value: item.provider, label: item.provider }))} placeholder="请选择已配置提供方" />
                </Form.Item>
                <Form.Item
                  label="模型 ID"
                  name="modelId"
                  rules={[{ required: true, message: '请输入模型 ID' }]}
                  extra="例如：deepseek-v4-flash、Qwen/Qwen2.5-VL-7B-Instruct。"
                >
                  <Input placeholder="例如：deepseek-v4-flash" />
                </Form.Item>
                <div className="admin-action-row">
                  <Button type="primary" htmlType="submit" loading={addingOption}>添加到候选列表</Button>
                </div>
              </Form>
            </Card>
            <Card size="small" title="已配置提供方" className="admin-build-summary">
              <Table
                columns={providerColumns}
                dataSource={providerConfigs.map((item) => ({ ...item, key: item.provider }))}
                pagination={false}
                locale={{ emptyText: '暂无提供方配置，请先添加提供方和 API Key。' }}
              />
            </Card>
          </div>
          <Card size="small" title="已添加模型" className="admin-build-summary">
            <Table
              columns={catalogColumns}
              dataSource={catalogRows}
              pagination={false}
              locale={{
                emptyText: (
                  <div className="admin-empty-state">
                    <strong>当前还没有任何模型</strong>
                    <div>系统已改为空白启动模式，请先在上方手动新增模型，然后再回到各模型页签设为当前并执行测试。</div>
                  </div>
                ),
              }}
            />
          </Card>
        </div>
      </Card>
    </div>
  )
}
