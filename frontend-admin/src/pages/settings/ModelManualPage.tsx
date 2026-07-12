/* eslint-disable react-hooks/set-state-in-effect -- remote configuration is loaded on mount */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClockCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Alert, Button, Card, Dropdown, Form, Input, Modal, Pagination, Select, Table, Tag, Tooltip, message } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import {
  addModelOption,
  getModelCatalog,
  getModelSettings,
  getProviderConfigs,
  removeModelOption,
  saveProviderConfig,
  selectModelOption,
  testModel,
} from '../../api/aiModelConfig'

type ModelCategory = 'embedding' | 'speech' | 'vision' | 'chat' | 'multimodal'
type AddedModelStatus = 'current' | 'candidate'
type ProviderStatus = 'success' | 'untested' | 'failed'

interface AdminModelOption {
  category: ModelCategory
  provider: string
  modelId: string
}

interface AdminModelCatalog {
  embeddingModels: AdminModelOption[]
  speechModels: AdminModelOption[]
  visionModels: AdminModelOption[]
  chatModels: AdminModelOption[]
  multimodalModels: AdminModelOption[]
}

interface ProviderConfig {
  provider: string
  baseUrl: string
  apiKey: string
  protocol: string
}

interface ModelManualPageProps {
  onCatalogChange?: (catalog: AdminModelCatalog) => void
  onProviderConfigsChange?: (providers: ProviderConfig[]) => void
}

interface ProviderItem extends ProviderConfig {
  status: ProviderStatus
  lastTestedAt?: string
}

interface SupportedModel {
  id: string
  name: string
  provider: string
  category: ModelCategory
  categoryLabel: string
  description: string
  capabilities: string[]
}

interface AddedModel {
  key: string
  category: ModelCategory
  categoryLabel: string
  provider: string
  modelId: string
  status: AddedModelStatus
}

interface ProviderFormValues {
  provider: string
  baseUrl: string
  apiKey: string
  protocol: string
}

interface AddModelFormValues {
  category: ModelCategory
  provider: string
  modelId: string
  capabilityInput?: string
}

const PRIMARY_COLOR = '#165DFF'
const SUCCESS_COLOR = '#00B42A'
const TEXT_MAIN = '#1D2129'
const TEXT_SECONDARY = '#4E5969'
const TEXT_MUTED = '#86909C'
const BORDER_COLOR = '#E5E6EB'
const INFO_BG = '#E6F4FF'
const DEFAULT_CHAT_MODEL_ID = 'deepseek-v4-pro'

const CATEGORY_OPTIONS: Array<{ value: ModelCategory; label: string }> = [
  { value: 'chat', label: '对话模型' },
  { value: 'vision', label: '视觉模型' },
  { value: 'multimodal', label: '多模态模型' },
  { value: 'embedding', label: '嵌入模型' },
  { value: 'speech', label: '语音音色' },
]

const CATEGORY_BY_VALUE = CATEGORY_OPTIONS.reduce<Record<ModelCategory, string>>(
  (map, item) => ({ ...map, [item.value]: item.label }),
  {} as Record<ModelCategory, string>,
)

const CAPABILITY_FILTERS = [
  { key: 'all', label: '全部' },
  ...CATEGORY_OPTIONS.map((item) => ({ key: item.value, label: item.label })),
]

const PROTOCOL_OPTIONS = [
  { value: 'openai_compatible', label: '兼容 OpenAI 协议' },
  { value: 'dashscope', label: 'DashScope 协议' },
  { value: 'custom', label: '自定义协议' },
]

const MODEL_MANUAL_STYLES = `
  .model-manual-page {
    display: grid;
    gap: 8px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: #FFFFFF;
  }

  .model-manual-alert {
    border: 0;
    border-radius: 8px;
    background: ${INFO_BG};
    padding: 8px 12px;
    color: ${TEXT_SECONDARY};
  }

  .model-manual-grid {
    display: grid;
    grid-template-columns: minmax(430px, 1fr) minmax(500px, 1.05fr);
    gap: 10px;
    align-items: stretch;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .model-manual-grid > .ant-card {
    min-height: 0;
  }

  .model-manual-card {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(29, 33, 41, 0.045);
    overflow: hidden;
  }

  .model-manual-card > .ant-card-head {
    min-height: 0;
    padding: 8px 12px 0;
    border-bottom: 0;
  }

  .model-manual-card > .ant-card-head .ant-card-head-title {
    padding: 0;
    color: ${TEXT_MAIN};
    font-size: 14px;
    font-weight: 600;
  }

  .model-manual-card > .ant-card-body {
    display: grid;
    flex: 1;
    min-height: 0;
    gap: 8px;
    padding: 8px 12px 10px;
  }

  .model-manual-toolbar {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 8px;
    margin-bottom: 6px;
  }

  .model-manual-filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 6px;
  }

  .model-manual-filter {
    height: 24px;
    padding: 0 10px;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 999px;
    background: #FFFFFF;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .model-manual-filter:hover,
  .model-manual-filter--active {
    border-color: rgba(22, 93, 255, 0.35);
    background: #E8F3FF;
    color: ${PRIMARY_COLOR};
  }

  .model-manual-list {
    border: 1px solid ${BORDER_COLOR};
    border-radius: 8px;
    overflow: hidden;
    background: #FFFFFF;
    min-height: 0;
    flex: 1;
  }

  .model-manual-model {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid ${BORDER_COLOR};
  }

  .model-manual-model:last-child {
    border-bottom: 0;
  }

  .model-manual-model__header {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .model-manual-dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: ${PRIMARY_COLOR};
    flex: 0 0 auto;
  }

  .model-manual-model__name {
    color: ${TEXT_MAIN};
    font-size: 13px;
    font-weight: 600;
    line-height: 1.25;
  }

  .model-manual-tag {
    margin-inline-end: 3px;
    border-color: #B7E3FF;
    background: #E6F7FF;
    color: ${PRIMARY_COLOR};
    font-size: 11px;
    line-height: 16px;
  }

  .model-manual-tag--green {
    border-color: #A7E8B4;
    background: #E8FFEA;
    color: ${SUCCESS_COLOR};
  }

  .model-manual-model__description {
    margin: 2px 0 0 12px;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    line-height: 1.3;
  }

  .model-manual-model__actions {
    display: flex;
    align-items: center;
    gap: 5px;
    align-self: center;
  }

  .model-manual-icon-button {
    width: 24px;
    height: 24px;
    padding: 0;
    border-color: transparent;
    color: ${TEXT_SECONDARY};
  }

  .model-manual-icon-button:hover {
    border-color: rgba(22, 93, 255, 0.35) !important;
    color: ${PRIMARY_COLOR} !important;
    background: #F2F6FF !important;
  }

  .model-manual-list-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 6px;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
  }

  .model-manual-link {
    color: ${PRIMARY_COLOR};
    font-size: 12px;
    font-weight: 500;
  }

  .model-manual-form {
    display: grid;
    gap: 6px;
  }

  .model-manual-form .ant-form-item {
    margin-bottom: 0;
  }

  .model-manual-form .ant-form-item-label {
    flex: 0 0 118px;
    max-width: 118px;
    padding-bottom: 0;
    text-align: left;
  }

  .model-manual-form .ant-form-item-label > label {
    color: ${TEXT_MAIN};
    font-size: 12px;
  }

  .model-manual-form .ant-form-item-control {
    min-width: 0;
  }

  .model-manual-form .ant-form-item-extra,
  .model-manual-help {
    min-height: 0;
    color: ${TEXT_MUTED};
    font-size: 12px;
    line-height: 1.25;
  }

  .model-manual-provider-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  .model-manual-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 6px 0 2px;
    padding: 5px 8px;
    border-radius: 6px;
    background: #F7F8FA;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
  }

  .model-manual-status__left {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .model-manual-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: ${TEXT_MUTED};
  }

  .model-manual-status-dot--success {
    background: ${SUCCESS_COLOR};
  }

  .model-manual-status-dot--failed {
    background: #F53F3F;
  }

  .model-manual-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
  }

  .model-manual-primary.ant-btn-primary {
    background: ${PRIMARY_COLOR};
    border-color: ${PRIMARY_COLOR};
    box-shadow: 0 4px 10px rgba(22, 93, 255, 0.22);
  }

  .model-manual-primary.ant-btn-primary:hover {
    background: #0E42D2 !important;
    border-color: #0E42D2 !important;
  }

  .model-manual-card .ant-btn-default:hover {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: #F7FAFF !important;
  }

  .model-manual-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid #E8EEF8;
    border-radius: 5px;
    background: #F7F8FA;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    line-height: 1.25;
  }

  .model-manual-add-provider-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 34px;
    gap: 8px;
  }

  .model-manual-table-card > .ant-card-body {
    padding-top: 6px;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .model-manual-table-card .ant-table-wrapper {
    min-height: 0;
  }

  .model-manual-table .ant-table {
    color: ${TEXT_MAIN};
    font-size: 12px;
  }

  .model-manual-table .ant-table-thead > tr > th {
    height: 30px;
    padding: 6px 10px;
    background: #F7F8FA;
    color: ${TEXT_MAIN};
    font-size: 12px;
    font-weight: 600;
  }

  .model-manual-table .ant-table-tbody > tr > td {
    height: 36px;
    padding: 6px 10px;
    border-color: ${BORDER_COLOR};
  }

  .model-manual-table .ant-table-tbody > tr.model-manual-current-row > td {
    background: #EAF4FF;
  }

  .model-manual-provider-cell {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .model-manual-provider-logo {
    display: inline-grid;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #E8F3FF;
    color: ${PRIMARY_COLOR};
    font-size: 9px;
    font-weight: 700;
  }

  .model-manual-table-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
  }

  .model-manual-table-footer .ant-pagination {
    margin: 0;
  }

  @media (max-width: 1180px) {
    .model-manual-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .model-manual-toolbar,
    .model-manual-provider-line,
    .model-manual-add-provider-row {
      grid-template-columns: 1fr;
    }

    .model-manual-form .ant-form-item-label {
      flex: 0 0 100%;
      max-width: 100%;
    }

    .model-manual-page {
      height: auto;
    }
  }
`

function toCatalog(models: AddedModel[]): AdminModelCatalog {
  const emptyCatalog: AdminModelCatalog = {
    embeddingModels: [],
    speechModels: [],
    visionModels: [],
    chatModels: [],
    multimodalModels: [],
  }

  models.forEach((model) => {
    const option = {
      category: model.category,
      provider: model.provider,
      modelId: model.modelId,
    }
    if (model.category === 'embedding') emptyCatalog.embeddingModels.push(option)
    if (model.category === 'speech') emptyCatalog.speechModels.push(option)
    if (model.category === 'vision') emptyCatalog.visionModels.push(option)
    if (model.category === 'chat') emptyCatalog.chatModels.push(option)
    if (model.category === 'multimodal') emptyCatalog.multimodalModels.push(option)
  })

  return emptyCatalog
}

function getProviderInitial(provider: string) {
  if (provider === 'DeepSeek') return 'DS'
  if (provider === 'Qwen') return 'Q'
  if (provider === 'Local TTS') return 'LT'
  if (provider === 'BGE') return 'BG'
  return provider.slice(0, 2).toUpperCase()
}

function renderCapabilityTag(tag: string) {
  const greenTags = ['推理', '问答', '代码', '数学', '检索']
  return (
    <Tag key={tag} className={`model-manual-tag${greenTags.includes(tag) ? ' model-manual-tag--green' : ''}`}>
      {tag}
    </Tag>
  )
}

export default function ModelManualPage({ onCatalogChange, onProviderConfigsChange }: ModelManualPageProps) {
  const [providerForm] = Form.useForm<ProviderFormValues>()
  const [addModelForm] = Form.useForm<AddModelFormValues>()
  const [newProviderForm] = Form.useForm<ProviderFormValues>()

  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [capabilityFilter, setCapabilityFilter] = useState<string>('all')
  const [alertVisible, setAlertVisible] = useState(true)
  const [testingConnection, setTestingConnection] = useState(false)
  const [savingProvider, setSavingProvider] = useState(false)
  const [providerModalOpen, setProviderModalOpen] = useState(false)
  const [addingModel, setAddingModel] = useState(false)
  const [testingModelKey, setTestingModelKey] = useState<string | null>(null)
  const [addedModels, setAddedModels] = useState<AddedModel[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const providerOptions = useMemo(
    () => providers.map((item) => ({ value: item.provider, label: item.provider })),
    [providers],
  )

  const selectedProviderConfig = useMemo(
    () => providers.find((item) => item.provider === selectedProvider) ?? providers[0],
    [providers, selectedProvider],
  )

  const providerValues = Form.useWatch([], providerForm)
  const addModelValues = Form.useWatch([], addModelForm)

  const providerSubmitDisabled = !providerValues?.provider || !providerValues?.baseUrl || !providerValues?.apiKey || !providerValues?.protocol
  const addModelDisabled = !addModelValues?.category || !addModelValues?.provider || !addModelValues?.modelId

  const loadRemoteConfig = useCallback(async () => {
    try {
      const [providerConfigs, settings] = await Promise.all([getProviderConfigs(), getModelSettings()])
      const catalogResponse = await getModelCatalog()
      const selectedByCategory: Record<ModelCategory, string> = {
        embedding: settings.embeddingModel,
        speech: settings.speechModel,
        vision: settings.visionModel,
        chat: settings.chatModel,
        multimodal: settings.multimodalModel,
      }
      const models = Object.values(catalogResponse).flat().map((option) => ({
        key: `${option.category}:${option.provider}:${option.modelId}`,
        category: option.category as ModelCategory,
        categoryLabel: CATEGORY_BY_VALUE[option.category as ModelCategory],
        provider: option.provider,
        modelId: option.modelId,
        status: selectedByCategory[option.category as ModelCategory] === option.modelId ? 'current' as const : 'candidate' as const,
      }))
      const nextProviders = providerConfigs.map((item) => ({ ...item, protocol: item.protocol ?? 'openai_compatible', status: 'untested' as const }))
      setProviders(nextProviders)
      setAddedModels(models)
      setSelectedProvider((current) => current || nextProviders[0]?.provider || '')
      onCatalogChange?.(toCatalog(models))
      onProviderConfigsChange?.(nextProviders)
    } catch {
      message.error('模型配置加载失败，请检查后端服务')
    }
  }, [onCatalogChange, onProviderConfigsChange])

  useEffect(() => {
    void loadRemoteConfig()
  }, [loadRemoteConfig])

  useEffect(() => {
    if (!selectedProviderConfig) return
    providerForm.setFieldsValue({
      provider: selectedProviderConfig.provider,
      baseUrl: selectedProviderConfig.baseUrl,
      apiKey: selectedProviderConfig.apiKey,
      protocol: selectedProviderConfig.protocol,
    })
    const currentAddModelValues = addModelForm.getFieldsValue()
    addModelForm.setFieldsValue({
      category: currentAddModelValues.category ?? 'chat',
      provider: selectedProviderConfig.provider,
      modelId: currentAddModelValues.modelId || DEFAULT_CHAT_MODEL_ID,
      capabilityInput: currentAddModelValues.capabilityInput,
    })
  }, [addModelForm, providerForm, selectedProviderConfig])

  useEffect(() => {
    onCatalogChange?.(toCatalog(addedModels))
  }, [addedModels, onCatalogChange])

  useEffect(() => {
    onProviderConfigsChange?.(
      providers.map(({ provider, baseUrl, apiKey, protocol }) => ({
        provider,
        baseUrl,
        apiKey,
        protocol,
      })),
    )
  }, [providers, onProviderConfigsChange])

  const filteredSupportedModels = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase()
    const remoteModels: SupportedModel[] = addedModels.map((model) => ({
      id: model.modelId,
      name: model.modelId,
      provider: model.provider,
      category: model.category,
      categoryLabel: model.categoryLabel,
      capabilities: [model.categoryLabel],
      description: `${model.provider} 提供的 ${model.categoryLabel}`,
    }))
    return remoteModels.filter((model) => {
      const matchesProvider = model.provider === selectedProvider
      const matchesCategory = capabilityFilter === 'all' || model.category === capabilityFilter
      const searchableText = `${model.id} ${model.name} ${model.description} ${model.capabilities.join(' ')}`.toLowerCase()
      const matchesKeyword = !normalizedKeyword || searchableText.includes(normalizedKeyword)
      return matchesProvider && matchesCategory && matchesKeyword
    })
  }, [addedModels, capabilityFilter, searchKeyword, selectedProvider])

  const pagedAddedModels = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return addedModels.slice(start, start + pageSize)
  }, [addedModels, currentPage, pageSize])

  const handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider)
    setCapabilityFilter('all')
    setSearchKeyword('')
  }

  const handleSaveProvider = async () => {
    const values = await providerForm.validateFields()
    setSavingProvider(true)
    try {
      await saveProviderConfig(values)
      await loadRemoteConfig()
      setSavingProvider(false)
      message.success('提供方配置已保存')
    } catch {
      setSavingProvider(false)
      message.error('提供方配置保存失败')
    }
  }

  const handleTestConnection = async () => {
    const values = await providerForm.validateFields()
    setTestingConnection(true)
    try {
      const model = addedModels.find((item) => item.provider === values.provider)
      if (!model) {
        message.warning('请先为该提供方添加模型，再执行真实连接测试')
        return
      }
      const response = await testModel({ category: model.category, modelId: model.modelId, text: '连接测试' })
      if (response.success) message.success(`${values.provider} 连接测试成功`)
      else message.error(response.detail ?? response.message)
    } catch {
      message.error(`${values.provider} 连接测试失败`)
    } finally {
      setTestingConnection(false)
    }
  }

  const handleCreateProvider = async () => {
    const values = await newProviderForm.validateFields()
    await saveProviderConfig(values)
    await loadRemoteConfig()
    setSelectedProvider(values.provider)
    setProviderModalOpen(false)
    newProviderForm.resetFields()
    message.success(`已新增提供方 ${values.provider}`)
  }

  const handleAddModel = async () => {
    const values = await addModelForm.validateFields()
    setAddingModel(true)
    try {
      await addModelOption(values)
      await loadRemoteConfig()
      addModelForm.setFieldsValue({
        category: 'chat',
        provider: selectedProviderConfig.provider,
        modelId: DEFAULT_CHAT_MODEL_ID,
        capabilityInput: '',
      })
      setAddingModel(false)
      message.success(`模型 ${values.modelId} 已添加到候选列表`)
    } catch {
      setAddingModel(false)
      message.error('模型添加失败')
    }
  }

  const handleSetCurrent = async (record: AddedModel) => {
    await selectModelOption(record)
    await loadRemoteConfig()
    message.success(`${record.modelId} 已设为当前使用`)
  }

  const handleTestModel = async (record: AddedModel) => {
    setTestingModelKey(record.key)
    try {
      const response = await testModel({ category: record.category, modelId: record.modelId, text: '模型连通性测试' })
      if (response.success) message.success(`${record.modelId} 测试通过`)
      else message.error(response.detail ?? response.message)
    } catch {
      message.error(`${record.modelId} 测试失败`)
    } finally {
      setTestingModelKey(null)
    }
  }

  const columns: TableColumnsType<AddedModel> = [
    {
      title: '分类',
      dataIndex: 'categoryLabel',
      width: 120,
    },
    {
      title: '提供方',
      dataIndex: 'provider',
      width: 140,
      render: (provider: string) => (
        <span className="model-manual-provider-cell">
          <span className="model-manual-provider-logo">{getProviderInitial(provider)}</span>
          {provider}
        </span>
      ),
    },
    {
      title: '模型 ID',
      dataIndex: 'modelId',
      ellipsis: true,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      width: 110,
      render: (status: AddedModelStatus) =>
        status === 'current' ? <Tag color="success">当前使用</Tag> : <Tag color="processing">候选</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 230,
      render: (_, record) => {
        const menuItems: MenuProps['items'] = [
          { key: 'copy', label: '复制模型 ID' },
          { key: 'remove', label: '从候选列表移除', danger: true },
        ]

        return (
          <div className="model-manual-provider-cell">
            <Button size="small" disabled={record.status === 'current'} onClick={() => handleSetCurrent(record)}>
              设为当前
            </Button>
            <Button size="small" loading={testingModelKey === record.key} onClick={() => handleTestModel(record)}>
              测试
            </Button>
            <Dropdown
              menu={{
                items: menuItems,
                onClick: ({ key }) => {
                  if (key === 'copy') {
                    void navigator.clipboard?.writeText(record.modelId)
                    message.success('模型 ID 已复制')
                  }
                  if (key === 'remove') {
                    void removeModelOption(record).then(loadRemoteConfig).catch(() => message.error('移除模型失败'))
                  }
                },
              }}
              trigger={['click']}
            >
              <Button size="small" icon={<MoreOutlined />} />
            </Dropdown>
          </div>
        )
      },
    },
  ]

  return (
    <div className="model-manual-page">
      <style>{MODEL_MANUAL_STYLES}</style>

      {alertVisible && (
        <Alert
          className="model-manual-alert"
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          closable
          onClose={() => setAlertVisible(false)}
          message="模型列表改为手动维护。按分类逐个添加模型提供方和模型 ID，更适合逐步扩展 provider 能力文件。"
        />
      )}

      <div className="model-manual-grid">
        <Card title="模型能力与支持模型" className="model-manual-card">
          <div className="model-manual-toolbar">
            <Select value={selectedProvider} options={providerOptions} onChange={handleProviderSelect} />
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: TEXT_MUTED }} />}
              placeholder="搜索模型 ID 或能力关键词"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
            />
          </div>

          <div className="model-manual-filter-row">
            {CAPABILITY_FILTERS.map((item) => (
              <button
                key={item.key}
                className={`model-manual-filter${capabilityFilter === item.key ? ' model-manual-filter--active' : ''}`}
                type="button"
                onClick={() => setCapabilityFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="model-manual-list">
            {filteredSupportedModels.map((model) => (
              <div className="model-manual-model" key={model.id}>
                <div>
                  <div className="model-manual-model__header">
                    <span className="model-manual-dot" />
                    <span className="model-manual-model__name">{model.name}</span>
                    {model.capabilities.map(renderCapabilityTag)}
                  </div>
                  <p className="model-manual-model__description">{model.description}</p>
                </div>
                <div className="model-manual-model__actions">
                  <Tooltip title="最近测试记录">
                    <Button className="model-manual-icon-button" icon={<ClockCircleOutlined />} />
                  </Tooltip>
                  <Tooltip title="模型文档">
                    <Button className="model-manual-icon-button" icon={<FileTextOutlined />} />
                  </Tooltip>
                </div>
              </div>
            ))}
            {!filteredSupportedModels.length && (
              <div style={{ padding: 24, textAlign: 'center', color: TEXT_MUTED }}>暂无匹配模型</div>
            )}
          </div>

          <div className="model-manual-list-footer">
            <span>共 {filteredSupportedModels.length} 个模型</span>
            <Button type="link" className="model-manual-link" icon={<FileTextOutlined />}>
              查看文档
            </Button>
          </div>
        </Card>

        <Card title="模型提供方配置" className="model-manual-card">
          <Form form={providerForm} className="model-manual-form" layout="horizontal" colon={false} requiredMark>
            <Form.Item label="提供方" name="provider" rules={[{ required: true, message: '请选择提供方' }]}>
              <div className="model-manual-provider-line">
                <Select options={providerOptions} onChange={handleProviderSelect} />
                <Button type="link" icon={<PlusOutlined />} onClick={() => setProviderModalOpen(true)}>
                  新增提供方
                </Button>
              </div>
            </Form.Item>
            <Form.Item
              label="Base URL"
              name="baseUrl"
              rules={[{ required: true, message: '请输入 Base URL' }]}
              extra="以 http(s):// 开头，结尾不需要 /"
            >
              <Input placeholder="https://api.deepseek.com" />
            </Form.Item>
            <Form.Item
              label="API Key"
              name="apiKey"
              rules={[{ required: true, message: '请输入 API Key' }]}
              extra="密钥将加密存储，仅用于调用接口"
            >
              <Input.Password placeholder="请输入提供方 API Key" />
            </Form.Item>
            <Form.Item
              label="协议"
              name="protocol"
              rules={[{ required: true, message: '请选择协议' }]}
              extra="选择与该提供方兼容的 API 协议"
            >
              <Select options={PROTOCOL_OPTIONS} />
            </Form.Item>
          </Form>

          <div className="model-manual-status">
            <span className="model-manual-status__left">
              <span className={`model-manual-status-dot model-manual-status-dot--${selectedProviderConfig?.status ?? 'untested'}`} />
              连接状态：
              <span style={{ color: selectedProviderConfig?.status === 'success' ? SUCCESS_COLOR : TEXT_MUTED }}>
                {selectedProviderConfig?.status === 'success' ? '连接成功' : '未测试'}
              </span>
            </span>
            <span>上次测试： {selectedProviderConfig?.lastTestedAt ?? '--'}</span>
          </div>

          <div className="model-manual-actions">
            <Button
              type="primary"
              className="model-manual-primary"
              loading={savingProvider}
              disabled={providerSubmitDisabled}
              onClick={() => void handleSaveProvider()}
            >
              保存提供方
            </Button>
            <Button loading={testingConnection} disabled={providerSubmitDisabled} onClick={() => void handleTestConnection()}>
              测试连接
            </Button>
          </div>
        </Card>

        <Card title="新增模型" className="model-manual-card">
          <Form form={addModelForm} className="model-manual-form" layout="horizontal" colon={false} requiredMark>
            <Form.Item label="模型分类" name="category" rules={[{ required: true, message: '请选择模型分类' }]}>
              <Select options={CATEGORY_OPTIONS} placeholder="请选择模型分类" />
            </Form.Item>
            <Form.Item label="模型提供方" name="provider" rules={[{ required: true, message: '请选择模型提供方' }]}>
              <div className="model-manual-add-provider-row">
                <Select options={providerOptions} placeholder="请选择模型提供方" />
                <Tooltip title="刷新提供方">
                  <Button icon={<ReloadOutlined />} />
                </Tooltip>
              </div>
            </Form.Item>
            <Form.Item
              label="模型 ID"
              name="modelId"
              rules={[{ required: true, message: '请输入模型 ID' }]}
              extra="例如：deepseek-v4-pro"
            >
              <Input placeholder="请输入模型 ID，例如：deepseek-v4-pro" />
            </Form.Item>
          </Form>

          <div className="model-manual-note">
            <InfoCircleOutlined style={{ color: PRIMARY_COLOR, marginTop: 2 }} />
            <span>请先在上方保存提供方的 Base URL 和 API Key，再选择该提供方添加模型。</span>
          </div>

          <Form form={addModelForm} className="model-manual-form" layout="horizontal" colon={false}>
            <Form.Item label="能力标签（可选）" name="capabilityInput">
              <Input
                maxLength={10}
                showCount
                placeholder="输入后回车添加，例如：推理、问答、长上下文"
                onPressEnter={(event) => event.preventDefault()}
              />
            </Form.Item>
          </Form>

          <Button
            block
            type="primary"
            className="model-manual-primary"
            loading={addingModel}
            disabled={addModelDisabled}
            onClick={() => void handleAddModel()}
          >
            添加到候选列表
          </Button>
        </Card>

        <Card title="已添加模型" className="model-manual-card model-manual-table-card">
          <Table
            rowKey="key"
            className="model-manual-table"
            columns={columns}
            dataSource={pagedAddedModels}
            pagination={false}
            size="small"
            rowClassName={(record) => (record.status === 'current' ? 'model-manual-current-row' : '')}
          />
          <div className="model-manual-table-footer">
            <span>共 {addedModels.length} 条</span>
            <Pagination
              current={currentPage}
              total={addedModels.length}
              pageSize={pageSize}
              showSizeChanger
              pageSizeOptions={[10, 20, 50]}
              locale={{ items_per_page: '条/页' }}
              onChange={(page, size) => {
                setCurrentPage(page)
                setPageSize(size)
              }}
            />
          </div>
        </Card>
      </div>

      <Modal
        title="新增提供方"
        open={providerModalOpen}
        okText="保存"
        cancelText="取消"
        onOk={() => void handleCreateProvider()}
        onCancel={() => setProviderModalOpen(false)}
        destroyOnHidden
      >
        <Form form={newProviderForm} layout="vertical" requiredMark>
          <Form.Item label="提供方" name="provider" rules={[{ required: true, message: '请输入提供方名称' }]}>
            <Input placeholder="例如：Moonshot / OpenAI" />
          </Form.Item>
          <Form.Item label="Base URL" name="baseUrl" rules={[{ required: true, message: '请输入 Base URL' }]}>
            <Input placeholder="https://api.example.com" />
          </Form.Item>
          <Form.Item label="API Key" name="apiKey" rules={[{ required: true, message: '请输入 API Key' }]}>
            <Input.Password placeholder="请输入 API Key" />
          </Form.Item>
          <Form.Item
            label="协议"
            name="protocol"
            initialValue="openai_compatible"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select options={PROTOCOL_OPTIONS} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
