/* eslint-disable react-hooks/set-state-in-effect -- effects synchronize the selected remote model and pagination */
import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Modal,
  Pagination,
  Select,
} from 'antd'
import type { FormInstance, MenuProps } from 'antd'
import {
  EllipsisOutlined,
  FileSearchOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type EmbeddingOption = {
  value: string
  provider?: string
}

type EmbeddingConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: EmbeddingOption[]
  onOpenManual: () => void
  onSave: () => void
  onTest: () => void
  onDeleteOption?: (option: EmbeddingOption) => void
  deletingModel?: string | null
  result: React.ReactNode
}

type ProviderTone = 'blue' | 'green' | 'purple'

interface RetrievalPreviewItem {
  id: string
  title: string
  similarity: number
}

interface EmbeddingModelRecord {
  key: string
  modelName: string
  modelCode: string
  provider: string
  providerTone: ProviderTone
  vectorDimension: number
  purpose: string
  maxInputLength: number
  endpoint: string
  externalKbCount: number
  sampleQuery: string
  connectionStatus: 'connected' | 'offline'
  featuredLabel?: string
  retrievalResults: RetrievalPreviewItem[]
  isCustom?: boolean
}

interface EmbeddingModelDraft {
  modelName: string
  modelCode: string
  provider: string
  vectorDimension: number
  maxInputLength: number
  endpoint: string
}

interface CreateModelFormValues {
  modelName: string
  modelCode: string
  provider: string
  vectorDimension: number
  maxInputLength: number
  endpoint: string
  purpose: string
}

const PRIMARY_COLOR = '#165DFF'
const SUCCESS_COLOR = '#00B42A'
const PURPLE_COLOR = '#722ED1'
const PAGE_SIZE = 5

const PROVIDER_THEME_MAP: Record<ProviderTone, { accent: string; text: string; icon: string }> = {
  blue: {
    accent: PRIMARY_COLOR,
    text: PRIMARY_COLOR,
    icon: 'B',
  },
  green: {
    accent: SUCCESS_COLOR,
    text: SUCCESS_COLOR,
    icon: 'O',
  },
  purple: {
    accent: PURPLE_COLOR,
    text: PURPLE_COLOR,
    icon: 'M',
  },
}

const EMBEDDING_PAGE_STYLES = `
  .admin-settings-card {
    overflow: hidden;
    border: 1px solid #E5E6EB;
    border-radius: 10px;
    box-shadow: 0 4px 14px rgba(17, 24, 39, 0.045);
  }

  .admin-settings-card > .ant-card-head {
    min-height: 0;
    padding: 10px 16px 0;
    border-bottom: none;
  }

  .admin-settings-card > .ant-card-head .ant-card-head-title {
    padding: 0;
    font-size: 16px;
    font-weight: 600;
    color: #1D2129;
  }

  .admin-settings-card > .ant-card-head .ant-card-extra {
    padding: 0;
  }

  .admin-settings-card > .ant-card-body {
    padding: 2px 12px 10px;
  }

  .admin-settings-card .ant-tabs-nav {
    margin: 0 0 8px;
  }

  .admin-settings-card .ant-tabs-tab {
    min-height: 36px;
    padding: 0 12px 7px 0;
    font-size: 13px;
    font-weight: 500;
    color: #4E5969;
  }

  .admin-settings-card .ant-tabs-tab + .ant-tabs-tab {
    margin-left: 12px;
  }

  .admin-settings-card .ant-tabs-content-holder,
  .admin-settings-card .ant-tabs-content,
  .admin-settings-card .ant-tabs-tabpane {
    overflow: hidden;
  }

  .admin-settings-card .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
    color: ${PRIMARY_COLOR};
  }

  .admin-settings-card .ant-tabs-ink-bar {
    background: ${PRIMARY_COLOR};
    border-radius: 999px;
  }

  .embedding-settings-page {
    display: grid;
    gap: 8px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .embedding-settings-page__layout {
    display: grid;
    grid-template-columns: minmax(380px, 0.92fr) minmax(560px, 1.75fr);
    gap: 10px;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

  .embedding-settings-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid #E5E6EB;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.035);
    overflow: hidden;
  }

  .embedding-settings-panel > .ant-card-head {
    min-height: 0;
    padding: 9px 12px 0;
    border-bottom: none;
  }

  .embedding-settings-panel > .ant-card-head .ant-card-head-title {
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: #1D2129;
  }

  .embedding-settings-panel > .ant-card-body {
    display: grid;
    flex: 1;
    min-height: 0;
    gap: 8px;
    padding: 8px 12px 10px;
  }

  .embedding-settings-list-card > .ant-card-body {
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
  }

  .embedding-settings-form-card > .ant-card-body {
    min-height: 0;
  }

  .embedding-settings-toolbar {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .embedding-settings-toolbar .ant-input-affix-wrapper {
    height: 30px;
    border-radius: 6px;
  }

  .embedding-settings-primary-btn {
    height: 30px;
    padding: 0 12px;
    border-radius: 6px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
    font-weight: 500;
  }

  .embedding-settings-primary-btn:hover,
  .embedding-settings-primary-btn:focus {
    border-color: #0E42D2 !important;
    background: #0E42D2 !important;
  }

  .embedding-settings-list {
    display: grid;
    gap: 5px;
    min-height: 0;
    align-content: start;
  }

  .embedding-settings-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    min-height: 60px;
    padding: 5px 8px;
    border: 1px solid #E5E6EB;
    border-radius: 7px;
    background: #FFFFFF;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .embedding-settings-item:hover {
    border-color: rgba(22, 93, 255, 0.35);
    box-shadow: 0 5px 12px rgba(22, 93, 255, 0.07);
  }

  .embedding-settings-item--active {
    border-color: ${PRIMARY_COLOR};
    background: linear-gradient(180deg, rgba(22, 93, 255, 0.05), rgba(22, 93, 255, 0.02));
    box-shadow: 0 5px 14px rgba(22, 93, 255, 0.09);
  }

  .embedding-settings-item__icon {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 700;
  }

  .embedding-settings-item__content {
    min-width: 0;
  }

  .embedding-settings-item__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .embedding-settings-item__title {
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 600;
    color: #1D2129;
  }

  .embedding-settings-item__badge {
    flex: none;
    padding: 0 7px;
    border-radius: 999px;
    background: rgba(22, 93, 255, 0.10);
    color: ${PRIMARY_COLOR};
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
  }

  .embedding-settings-item__meta,
  .embedding-settings-item__purpose {
    font-size: 12px;
    line-height: 1.2;
    color: #86909C;
  }

  .embedding-settings-item__meta {
    margin-top: 2px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .embedding-settings-provider-text {
    color: #4E5969;
  }

  .embedding-settings-item__actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .embedding-settings-icon-btn {
    width: 26px;
    height: 26px;
    border: 1px solid #E5E6EB;
    border-radius: 50%;
    background: #FFFFFF;
    color: ${PRIMARY_COLOR};
    box-shadow: none;
  }

  .embedding-settings-icon-btn:hover,
  .embedding-settings-icon-btn:focus {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.06) !important;
  }

  .embedding-settings-pagination {
    display: flex;
    justify-content: center;
    padding-top: 0;
    min-height: 26px;
  }

  .embedding-settings-pagination .ant-pagination-item,
  .embedding-settings-pagination .ant-pagination-prev,
  .embedding-settings-pagination .ant-pagination-next {
    min-width: 26px;
    height: 26px;
    line-height: 24px;
    border-radius: 6px;
  }

  .embedding-settings-pagination .ant-pagination-item-active {
    border-color: ${PRIMARY_COLOR};
  }

  .embedding-settings-form-section {
    display: grid;
    gap: 7px;
  }

  .embedding-settings-form-label {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
    font-size: 12px;
    font-weight: 500;
    color: #1D2129;
  }

  .embedding-settings-form-label__required {
    color: #F53F3F;
  }

  .embedding-settings-mini-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #1D2129;
  }

  .embedding-settings-mini-title::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 999px;
    background: ${PRIMARY_COLOR};
  }

  .embedding-settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 14px;
  }

  .embedding-settings-control .ant-input,
  .embedding-settings-control .ant-input-affix-wrapper,
  .embedding-settings-control .ant-select-selector {
    height: 30px !important;
    border-radius: 6px !important;
  }

  .embedding-settings-status {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 5px 9px;
    border: 1px solid #E5E6EB;
    border-radius: 6px;
    background: #FFFFFF;
    color: #4E5969;
    font-size: 12px;
  }

  .embedding-settings-status__item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .embedding-settings-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${SUCCESS_COLOR};
    box-shadow: 0 0 0 3px rgba(0, 180, 42, 0.12);
  }

  .embedding-settings-status__text--success,
  .embedding-settings-retrieval__score {
    color: ${SUCCESS_COLOR};
    font-weight: 600;
  }

  .embedding-settings-status__link {
    color: ${PRIMARY_COLOR};
    font-weight: 600;
  }

  .embedding-settings-retrieval {
    display: grid;
    gap: 6px;
  }

  .embedding-settings-retrieval__toolbar {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 7px;
  }

  .embedding-settings-retrieval__toolbar .ant-input-affix-wrapper,
  .embedding-settings-retrieval__toolbar .ant-input {
    border-radius: 6px;
  }

  .embedding-settings-retrieval__toolbar .ant-input {
    min-height: 30px !important;
    line-height: 1.25;
  }

  .embedding-settings-retrieval__list {
    display: grid;
    gap: 5px;
    padding: 7px 9px;
    border: 1px solid #E5E6EB;
    border-radius: 6px;
    background: #F7F8FA;
  }

  .embedding-settings-retrieval__header {
    font-size: 12px;
    color: #4E5969;
    font-weight: 500;
  }

  .embedding-settings-retrieval__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
    color: #1D2129;
  }

  .embedding-settings-retrieval__title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .embedding-settings-retrieval__title span:last-child {
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .embedding-settings-footer {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    padding-top: 2px;
  }

  .embedding-settings-default-btn {
    height: 30px;
    padding: 0 12px;
    border-radius: 6px;
    border-color: #D0D3D9;
    color: #1D2129;
    background: #FFFFFF;
    box-shadow: none;
  }

  .embedding-settings-default-btn:hover,
  .embedding-settings-default-btn:focus {
    color: #1D2129 !important;
    border-color: #C9CDD4 !important;
    background: #F7F8FA !important;
  }

  .embedding-settings-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    line-height: 1.25;
    color: #86909C;
  }

  .embedding-settings-extra-result {
    overflow: visible;
    padding-top: 0;
  }

  .embedding-settings-extra-result .ant-card,
  .embedding-settings-extra-result .admin-build-summary {
    margin: 0;
  }

  .embedding-settings-extra-result .ant-card-body {
    padding: 6px 8px !important;
  }

  .embedding-settings-extra-result .admin-test-result {
    gap: 3px;
  }

  .embedding-settings-extra-result .admin-test-result__header,
  .embedding-settings-extra-result .admin-test-result__meta {
    min-height: 0;
    line-height: 1.25;
  }

  .embedding-settings-extra-result .admin-test-result__summary,
  .embedding-settings-extra-result .admin-build-summary__time {
    line-height: 1.25;
  }

  .embedding-settings-empty {
    display: grid;
    place-items: center;
    min-height: 220px;
    color: #86909C;
    font-size: 14px;
    text-align: center;
    border: 1px dashed #E5E6EB;
    border-radius: 12px;
    background: #FAFBFC;
  }

  .embedding-settings-modal .ant-modal-content {
    border-radius: 16px;
    padding: 20px 20px 12px;
  }

  @media (max-width: 1080px) {
    .embedding-settings-page__layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 900px) {
    .embedding-settings-grid,
    .embedding-settings-retrieval__toolbar {
      grid-template-columns: 1fr;
    }

    .embedding-settings-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .embedding-settings-item {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .embedding-settings-item__actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }

    .embedding-settings-status {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
  }
`

const BASE_EMBEDDING_MODELS: EmbeddingModelRecord[] = [
  {
    key: 'baai-bge-m3',
    modelName: 'BAAI/bge-m3',
    modelCode: 'BAAI/bge-m3',
    provider: 'BAAI',
    providerTone: 'blue',
    vectorDimension: 1024,
    purpose: '第三方知识服务 / 向量化',
    maxInputLength: 8192,
    endpoint: 'http://localhost:8000/v1/embeddings',
    externalKbCount: 3,
    sampleQuery: '北京烤鸭推荐',
    connectionStatus: 'connected',
    featuredLabel: '当前使用',
    retrievalResults: [
      { id: 'bge-1', title: '北京烤鸭的历史与制作工艺详解', similarity: 92.31 },
      { id: 'bge-2', title: '北京特色美食推荐：烤鸭、涮羊肉等', similarity: 89.12 },
      { id: 'bge-3', title: '北京旅游必吃美食清单', similarity: 86.45 },
    ],
  },
  {
    key: 'text-embedding-3-large',
    modelName: 'text-embedding-3-large',
    modelCode: 'text-embedding-3-large',
    provider: 'OpenAI',
    providerTone: 'green',
    vectorDimension: 3072,
    purpose: '高精度召回',
    maxInputLength: 8192,
    endpoint: 'https://api.openai.com/v1/embeddings',
    externalKbCount: 5,
    sampleQuery: '博物馆讲解推荐',
    connectionStatus: 'connected',
    retrievalResults: [
      { id: 'oai-large-1', title: '国家博物馆重点展厅导览路线', similarity: 94.25 },
      { id: 'oai-large-2', title: '适合亲子参观的北京博物馆推荐', similarity: 90.64 },
      { id: 'oai-large-3', title: '热门展馆预约与讲解服务对比', similarity: 88.37 },
    ],
  },
  {
    key: 'text-embedding-3-small',
    modelName: 'text-embedding-3-small',
    modelCode: 'text-embedding-3-small',
    provider: 'OpenAI',
    providerTone: 'green',
    vectorDimension: 1536,
    purpose: '轻量部署',
    maxInputLength: 8192,
    endpoint: 'https://api.openai.com/v1/embeddings',
    externalKbCount: 4,
    sampleQuery: '景区问答检索',
    connectionStatus: 'connected',
    retrievalResults: [
      { id: 'oai-small-1', title: '景区常见问题与答案模板', similarity: 91.18 },
      { id: 'oai-small-2', title: '游客服务中心问答示例', similarity: 88.56 },
      { id: 'oai-small-3', title: '轻量化向量检索在景区场景的应用', similarity: 84.79 },
    ],
  },
  {
    key: 'bge-large-zh-v1.5',
    modelName: 'bge-large-zh-v1.5',
    modelCode: 'bge-large-zh-v1.5',
    provider: 'BAAI',
    providerTone: 'blue',
    vectorDimension: 1024,
    purpose: '中文优化',
    maxInputLength: 4096,
    endpoint: 'http://localhost:8000/v1/embeddings',
    externalKbCount: 2,
    sampleQuery: '非遗文化讲解',
    connectionStatus: 'connected',
    retrievalResults: [
      { id: 'bge-large-1', title: '北京非遗文化主题线路推荐', similarity: 90.42 },
      { id: 'bge-large-2', title: '传统手工艺体验活动汇总', similarity: 86.17 },
      { id: 'bge-large-3', title: '非遗馆藏与互动讲解方案', similarity: 84.23 },
    ],
  },
  {
    key: 'm3e-large',
    modelName: 'm3e-large',
    modelCode: 'm3e-large',
    provider: 'Moka AI',
    providerTone: 'purple',
    vectorDimension: 1024,
    purpose: '语义匹配',
    maxInputLength: 4096,
    endpoint: 'http://localhost:8000/v1/embeddings',
    externalKbCount: 1,
    sampleQuery: '景点语义召回',
    connectionStatus: 'connected',
    retrievalResults: [
      { id: 'm3e-1', title: '自然语言问答与景点描述匹配策略', similarity: 88.96 },
      { id: 'm3e-2', title: '游客问题相似语义聚类案例', similarity: 85.74 },
      { id: 'm3e-3', title: '热门景区标签语义扩展方案', similarity: 82.65 },
    ],
  },
]

function createDerivedModel(option: EmbeddingOption): EmbeddingModelRecord {
  const provider = option.provider ?? '自定义'
  const providerTone: ProviderTone = provider.includes('OpenAI')
    ? 'green'
    : provider.includes('Moka')
      ? 'purple'
      : 'blue'

  return {
    key: `derived-${option.value}`,
    modelName: option.value,
    modelCode: option.value,
    provider,
    providerTone,
    vectorDimension: provider.includes('OpenAI') ? 1536 : 1024,
    purpose: '第三方知识检索',
    maxInputLength: 8192,
    endpoint: provider.includes('OpenAI') ? 'https://api.openai.com/v1/embeddings' : 'http://localhost:8000/v1/embeddings',
    externalKbCount: 2,
    sampleQuery: '第三方知识语义检索',
    connectionStatus: 'connected',
    retrievalResults: [
      { id: `${option.value}-1`, title: '第三方知识内容匹配结果示例一', similarity: 90.12 },
      { id: `${option.value}-2`, title: '第三方知识内容匹配结果示例二', similarity: 87.48 },
      { id: `${option.value}-3`, title: '第三方知识内容匹配结果示例三', similarity: 83.36 },
    ],
  }
}

function toDraft(model: EmbeddingModelRecord): EmbeddingModelDraft {
  return {
    modelName: model.modelName,
    modelCode: model.modelCode,
    provider: model.provider,
    vectorDimension: model.vectorDimension,
    maxInputLength: model.maxInputLength,
    endpoint: model.endpoint,
  }
}

export default function EmbeddingConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onOpenManual,
  onSave,
  onTest,
  onDeleteOption,
  deletingModel,
  result,
}: EmbeddingConfigPageProps) {
  const watchedEmbeddingModel = Form.useWatch('embeddingModel', form)
  const [createForm] = Form.useForm<CreateModelFormValues>()
  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string>(BASE_EMBEDDING_MODELS[0].key)
  const [draft, setDraft] = useState<EmbeddingModelDraft>(() => toDraft(BASE_EMBEDDING_MODELS[0]))
  const [retrievalText, setRetrievalText] = useState(BASE_EMBEDDING_MODELS[0].sampleQuery)
  const [retrievalPreviewText, setRetrievalPreviewText] = useState(BASE_EMBEDDING_MODELS[0].sampleQuery)

  const mergedBaseModels = useMemo(() => {
    const modelMap = new Map(BASE_EMBEDDING_MODELS.map((item) => [item.modelCode, item]))
    const derivedModels = options
      .filter((item) => !modelMap.has(item.value))
      .map(createDerivedModel)
    return [...BASE_EMBEDDING_MODELS, ...derivedModels]
  }, [options])

  const embeddingModels = useMemo(
    () => mergedBaseModels,
    [mergedBaseModels],
  )

  useEffect(() => {
    if (!embeddingModels.length) {
      return
    }

    const matchedModel = watchedEmbeddingModel
      ? embeddingModels.find((item) => item.modelCode === watchedEmbeddingModel || item.modelName === watchedEmbeddingModel)
      : undefined

    if (matchedModel) {
      setSelectedKey(matchedModel.key)
      setDraft(toDraft(matchedModel))
      setRetrievalText(matchedModel.sampleQuery)
      setRetrievalPreviewText(matchedModel.sampleQuery)
      return
    }

    if (!embeddingModels.some((item) => item.key === selectedKey)) {
      const fallbackModel = embeddingModels[0]
      setSelectedKey(fallbackModel.key)
      setDraft(toDraft(fallbackModel))
      setRetrievalText(fallbackModel.sampleQuery)
      setRetrievalPreviewText(fallbackModel.sampleQuery)
      form.setFieldValue('embeddingModel', fallbackModel.modelCode)
    }
  }, [embeddingModels, form, selectedKey, watchedEmbeddingModel])

  const selectedModel = useMemo(
    () => embeddingModels.find((item) => item.key === selectedKey),
    [embeddingModels, selectedKey],
  )

  useEffect(() => {
    if (!selectedModel) {
      return
    }

    if (form.getFieldValue('embeddingModel') !== selectedModel.modelCode) {
      form.setFieldValue('embeddingModel', selectedModel.modelCode)
    }
  }, [form, selectedModel])

  const providerOptions = useMemo(
    () => Array.from(new Set(embeddingModels.map((item) => item.provider))).map((item) => ({ label: item, value: item })),
    [embeddingModels],
  )

  const filteredModels = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase()
    if (!normalizedKeyword) {
      return embeddingModels
    }

    return embeddingModels.filter((item) => (
      item.modelName.toLowerCase().includes(normalizedKeyword)
      || item.modelCode.toLowerCase().includes(normalizedKeyword)
      || item.provider.toLowerCase().includes(normalizedKeyword)
      || item.purpose.toLowerCase().includes(normalizedKeyword)
    ))
  }, [embeddingModels, searchKeyword])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword])

  const pagedModels = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return filteredModels.slice(startIndex, startIndex + PAGE_SIZE)
  }, [currentPage, filteredModels])

  const handleSelectModel = (model: EmbeddingModelRecord) => {
    setSelectedKey(model.key)
    setDraft(toDraft(model))
    setRetrievalText(model.sampleQuery)
    setRetrievalPreviewText(model.sampleQuery)
    form.setFieldValue('embeddingModel', model.modelCode)
  }

  const handleDraftChange = <K extends keyof EmbeddingModelDraft>(
    field: K,
    value: EmbeddingModelDraft[K],
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleRetrievePreview = () => {
    setRetrievalPreviewText(retrievalText.trim() || selectedModel?.sampleQuery || '')
  }

  const handleReset = () => {
    if (!selectedModel) {
      return
    }

    setDraft(toDraft(selectedModel))
    setRetrievalText(selectedModel.sampleQuery)
    setRetrievalPreviewText(selectedModel.sampleQuery)
    form.setFieldValue('embeddingModel', selectedModel.modelCode)
  }

  const handleCreateModel = async () => {
    await createForm.validateFields()
    onOpenManual()
  }

  const handleDelete = (model: EmbeddingModelRecord) => {
    if (onDeleteOption) {
      onDeleteOption({
        value: model.modelCode,
        provider: model.provider,
      })
    }
  }

  const buildMenuItems = (model: EmbeddingModelRecord): MenuProps['items'] => {
    if (!onDeleteOption && !model.isCustom) {
      return [{ key: 'placeholder', label: '暂无更多操作', disabled: true }]
    }

    return [{
      key: 'delete',
      label: deletingModel === model.modelCode ? '删除中...' : '删除模型',
      danger: true,
      disabled: deletingModel === model.modelCode,
      onClick: () => handleDelete(model),
    }]
  }

  if (!selectedModel) {
    return (
      <div className="embedding-settings-page">
        <style>{EMBEDDING_PAGE_STYLES}</style>
        <div className="embedding-settings-empty">当前没有可展示的嵌入模型，请先在手动维护中添加模型。</div>
      </div>
    )
  }

  return (
    <div className="embedding-settings-page">
      <style>{EMBEDDING_PAGE_STYLES}</style>
      <div className="embedding-settings-page__layout">
        <Card
          title="嵌入模型列表"
          className="embedding-settings-panel embedding-settings-list-card"
        >
          <div className="embedding-settings-toolbar">
            <Input
              allowClear
              placeholder="搜索模型"
              prefix={<SearchOutlined style={{ color: '#86909C' }} />}
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="embedding-settings-primary-btn"
              onClick={onOpenManual}
            >
              手动维护
            </Button>
          </div>

          <div className="embedding-settings-list">
            {pagedModels.map((item) => {
              const theme = PROVIDER_THEME_MAP[item.providerTone]

              return (
                <div
                  key={item.key}
                  className={`embedding-settings-item ${item.key === selectedKey ? 'embedding-settings-item--active' : ''}`}
                  onClick={() => handleSelectModel(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelectModel(item)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    className="embedding-settings-item__icon"
                    style={{ background: `linear-gradient(180deg, ${theme.accent}, ${theme.text})` }}
                  >
                    {theme.icon}
                  </div>
                  <div className="embedding-settings-item__content">
                    <div className="embedding-settings-item__title-row">
                      <span className="embedding-settings-item__title">{item.modelName}</span>
                      {item.featuredLabel ? (
                        <span className="embedding-settings-item__badge">{item.featuredLabel}</span>
                      ) : null}
                    </div>
                    <div className="embedding-settings-item__meta">
                      <span className="embedding-settings-provider-text">提供方：{item.provider}</span>
                      <span>{item.vectorDimension}维</span>
                    </div>
                    <div className="embedding-settings-item__purpose">用途：{item.purpose}</div>
                  </div>
                  <div className="embedding-settings-item__actions">
                    <Button
                      type="text"
                      className="embedding-settings-icon-btn"
                      icon={<PlayCircleOutlined />}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleSelectModel(item)
                        onTest()
                      }}
                      loading={testing && item.key === selectedKey}
                    />
                    <Dropdown menu={{ items: buildMenuItems(item) }} trigger={['click']}>
                      <Button
                        type="text"
                        className="embedding-settings-icon-btn"
                        icon={<EllipsisOutlined />}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </Dropdown>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="embedding-settings-pagination">
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              size="small"
              total={filteredModels.length}
              onChange={setCurrentPage}
              showSizeChanger={false}
            />
          </div>
        </Card>

        <Card
          title="模型配置"
          className="embedding-settings-panel embedding-settings-form-card"
        >
          <div className="embedding-settings-form-section">
            <div className="embedding-settings-mini-title">基本信息</div>

            <div className="embedding-settings-grid">
              <div className="embedding-settings-control">
                <div className="embedding-settings-form-label">
                  <span>模型名称</span>
                  <span className="embedding-settings-form-label__required">*</span>
                </div>
                <Input
                  value={draft.modelName}
                  onChange={(event) => handleDraftChange('modelName', event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="embedding-settings-control">
                <div className="embedding-settings-form-label">
                  <span>模型标识</span>
                  <span className="embedding-settings-form-label__required">*</span>
                </div>
                <Input
                  value={draft.modelCode}
                  onChange={(event) => handleDraftChange('modelCode', event.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="embedding-settings-control">
                <div className="embedding-settings-form-label">
                  <span>服务提供方</span>
                  <span className="embedding-settings-form-label__required">*</span>
                </div>
                <Select
                  value={draft.provider}
                  options={providerOptions}
                  onChange={(value) => handleDraftChange('provider', value)}
                  disabled={loading}
                />
              </div>

              <div className="embedding-settings-control">
                <div className="embedding-settings-form-label">
                  <span>向量维度</span>
                  <span className="embedding-settings-form-label__required">*</span>
                </div>
                <Input
                  value={String(draft.vectorDimension)}
                  onChange={(event) => handleDraftChange('vectorDimension', Number(event.target.value) || 0)}
                  disabled={loading}
                />
              </div>

              <div className="embedding-settings-control">
                <div className="embedding-settings-form-label">
                  <span>最大输入长度</span>
                  <span className="embedding-settings-form-label__required">*</span>
                </div>
                <Input
                  value={String(draft.maxInputLength)}
                  suffix="tokens"
                  onChange={(event) => handleDraftChange('maxInputLength', Number(event.target.value) || 0)}
                  disabled={loading}
                />
              </div>

              <div className="embedding-settings-control">
                <div className="embedding-settings-form-label">
                  <span>接口地址</span>
                  <span className="embedding-settings-form-label__required">*</span>
                </div>
                <Input
                  value={draft.endpoint}
                  onChange={(event) => handleDraftChange('endpoint', event.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="embedding-settings-status">
              <div className="embedding-settings-status__item">
                <span className="embedding-settings-status__dot" />
                <span>连接状态：</span>
                <span className="embedding-settings-status__text--success">
                  {selectedModel.connectionStatus === 'connected' ? '已连接' : '未连接'}
                </span>
              </div>
              <div className="embedding-settings-status__item">
                <LinkOutlined style={{ color: PRIMARY_COLOR }} />
                <span>第三方知识源：</span>
                <span className="embedding-settings-status__link">{selectedModel.externalKbCount}个</span>
              </div>
            </div>
          </div>

          <div className="embedding-settings-form-section">
            <div className="embedding-settings-mini-title">测试检索</div>

            <div className="embedding-settings-retrieval">
              <div className="embedding-settings-retrieval__toolbar">
                <Input.TextArea
                  value={retrievalText}
                  autoSize={{ minRows: 1, maxRows: 1 }}
                  placeholder="输入测试文本，例如：北京烤鸭推荐"
                  onChange={(event) => setRetrievalText(event.target.value)}
                  disabled={loading}
                />
                <Button
                  type="primary"
                  className="embedding-settings-primary-btn"
                  icon={<FileSearchOutlined />}
                  onClick={handleRetrievePreview}
                >
                  检索
                </Button>
              </div>

              <div className="embedding-settings-retrieval__list">
                <div className="embedding-settings-retrieval__header">
                  检索结果预览（Top 3）
                  {retrievalPreviewText ? `：${retrievalPreviewText}` : ''}
                </div>
                {selectedModel.retrievalResults.map((item) => (
                  <div key={item.id} className="embedding-settings-retrieval__item">
                    <div className="embedding-settings-retrieval__title">
                      <FileSearchOutlined style={{ color: '#86909C' }} />
                      <span>{item.title}</span>
                    </div>
                    <span className="embedding-settings-retrieval__score">相似度 {item.similarity.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="embedding-settings-footer">
            <Button
              type="primary"
              className="embedding-settings-primary-btn"
              loading={saving}
              onClick={() => {
                form.setFieldValue('embeddingModel', draft.modelCode)
                onSave()
              }}
            >
              保存设置
            </Button>
            <Button
              className="embedding-settings-default-btn"
              loading={testing}
              onClick={() => {
                form.setFieldValue('embeddingModel', draft.modelCode)
                onTest()
              }}
            >
              测试当前模型
            </Button>
            <Button className="embedding-settings-default-btn" onClick={handleReset}>
              重置表单
            </Button>
          </div>

          <div className="embedding-settings-note">
            <InfoCircleOutlined />
            <span>嵌入模型用于将文本转为向量，支撑第三方知识检索等，可按模型维度和精度需求灵活配置。</span>
          </div>

          {result ? (
            <div className="embedding-settings-extra-result">
              {result}
            </div>
          ) : null}
        </Card>
      </div>

      <Modal
        title="新增模型"
        open={isCreateModalOpen}
        onOk={() => void handleCreateModel()}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        okText="确认新增"
        cancelText="取消"
        className="embedding-settings-modal"
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            provider: 'BAAI',
            vectorDimension: 1024,
            maxInputLength: 8192,
            endpoint: 'http://localhost:8000/v1/embeddings',
            purpose: '第三方知识检索',
          }}
        >
          <Form.Item
            label="模型名称"
            name="modelName"
            rules={[{ required: true, message: '请输入模型名称' }]}
          >
            <Input placeholder="例如：BAAI/bge-m3" />
          </Form.Item>
          <Form.Item
            label="模型标识"
            name="modelCode"
            rules={[{ required: true, message: '请输入模型标识' }]}
          >
            <Input placeholder="例如：BAAI/bge-m3" />
          </Form.Item>
          <Form.Item
            label="服务提供方"
            name="provider"
            rules={[{ required: true, message: '请选择服务提供方' }]}
          >
            <Select
              options={[
                { label: 'BAAI', value: 'BAAI' },
                { label: 'OpenAI', value: 'OpenAI' },
                { label: 'Moka AI', value: 'Moka AI' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="向量维度"
            name="vectorDimension"
            rules={[{ required: true, message: '请输入向量维度' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="最大输入长度"
            name="maxInputLength"
            rules={[{ required: true, message: '请输入最大输入长度' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="接口地址"
            name="endpoint"
            rules={[{ required: true, message: '请输入接口地址' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="用途"
            name="purpose"
            rules={[{ required: true, message: '请输入用途说明' }]}
          >
            <Input placeholder="例如：第三方知识服务 / 向量化" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
