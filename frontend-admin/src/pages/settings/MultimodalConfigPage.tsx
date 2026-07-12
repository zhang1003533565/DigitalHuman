import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  InfoCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, InputNumber, Modal, Pagination, Select, Tag, Upload } from 'antd'
import type { FormInstance, UploadProps } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type MultimodalOption = {
  value: string
  provider?: string
}

type MultimodalConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: MultimodalOption[]
  onOpenManual: () => void
  onSave: () => void
  onTest: (payload?: { promptText?: string; imageDataUrl?: string; mode?: string }) => void
  result: ReactNode
  testResult?: {
    success: boolean
    message: string
    detail?: string
    caption?: string
    ocrText?: string
    modelAnswer?: string
    sceneSummary?: string
  } | null
}

type ProviderTone = 'openai' | 'qwen' | 'google' | 'zhipu' | 'internlm'

interface MultimodalModelRecord {
  key: string
  modelName: string
  modelCode: string
  provider: string
  providerTone: ProviderTone
  contextLength: number
  maxImageSize: number
  endpoint: string
  externalKbCount: number
  capabilityTags: string[]
  featuredLabel?: string
}

interface MultimodalModelFormValues {
  modelName: string
  modelCode: string
  provider: string
  contextLength: number
  maxImageSize: number
  endpoint: string
}

interface CreateMultimodalModelValues {
  modelName: string
  modelCode: string
  provider: string
  contextLength: number
  maxImageSize: number
  endpoint: string
}

interface ResultBlock {
  key: 'caption' | 'ocr' | 'answer'
  title: string
  color: string
  text: string
}

const PRIMARY_COLOR = '#165DFF'
const SUCCESS_COLOR = '#00B42A'
const TEXT_MAIN = '#1D2129'
const TEXT_SECONDARY = '#4E5969'
const TEXT_MUTED = '#86909C'
const BORDER_COLOR = '#E5E6EB'
const PAGE_SIZE = 5

const QUICK_TAGS = ['图片问答', 'OCR 识别', '场景理解', '内容总结']

const PROVIDER_THEME: Record<ProviderTone, { color: string; icon: string }> = {
  openai: { color: '#10A37F', icon: 'O' },
  qwen: { color: '#722ED1', icon: 'Q' },
  google: { color: '#4285F4', icon: 'G' },
  zhipu: { color: '#1677FF', icon: 'Z' },
  internlm: { color: '#7B61FF', icon: 'I' },
}

const BASE_MODELS: MultimodalModelRecord[] = [
  {
    key: 'gpt-4o',
    modelName: 'gpt-4o',
    modelCode: 'gpt-4o',
    provider: 'OpenAI',
    providerTone: 'openai',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    externalKbCount: 12,
    capabilityTags: ['图文理解', 'OCR', '问答', '推理'],
    featuredLabel: '当前使用',
  },
  {
    key: 'qwen2.5-vl-7b-instruct',
    modelName: 'Qwen/Qwen2.5-VL-7B-Instruct',
    modelCode: 'qwen2.5-vl-7b-instruct',
    provider: 'Qwen',
    providerTone: 'qwen',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    externalKbCount: 8,
    capabilityTags: ['图文问答', 'OCR', '场景识别'],
  },
  {
    key: 'gemini-2.0-flash',
    modelName: 'gemini-2.0-flash',
    modelCode: 'gemini-2.0-flash',
    provider: 'Google',
    providerTone: 'google',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
    externalKbCount: 6,
    capabilityTags: ['多模态理解', '推理'],
  },
  {
    key: 'glm-4v',
    modelName: 'GLM-4.1V',
    modelCode: 'glm-4.1v',
    provider: '智谱 AI',
    providerTone: 'zhipu',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    externalKbCount: 10,
    capabilityTags: ['图像问答', 'OCR', '分类'],
  },
  {
    key: 'internlm-vl2',
    modelName: 'InternVL2.5-8B',
    modelCode: 'internvl2.5-8b',
    provider: 'InternLM',
    providerTone: 'internlm',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://internlm.example.com/v1/chat/completions',
    externalKbCount: 4,
    capabilityTags: ['图片理解', '视觉问答'],
  },
  {
    key: 'gpt-4o-mini',
    modelName: 'gpt-4o-mini',
    modelCode: 'gpt-4o-mini',
    provider: 'OpenAI',
    providerTone: 'openai',
    contextLength: 128000,
    maxImageSize: 3072,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    externalKbCount: 7,
    capabilityTags: ['图文理解', '问答'],
  },
  {
    key: 'qwen-vl-max',
    modelName: 'Qwen2-VL-Max',
    modelCode: 'qwen-vl-max',
    provider: 'Qwen',
    providerTone: 'qwen',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    externalKbCount: 9,
    capabilityTags: ['图文理解', 'OCR', '推理'],
  },
  {
    key: 'gemini-1.5-pro',
    modelName: 'gemini-1.5-pro',
    modelCode: 'gemini-1.5-pro',
    provider: 'Google',
    providerTone: 'google',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent',
    externalKbCount: 5,
    capabilityTags: ['图文理解', '推理'],
  },
  {
    key: 'glm-4v-plus',
    modelName: 'GLM-4V-Plus',
    modelCode: 'glm-4v-plus',
    provider: '智谱 AI',
    providerTone: 'zhipu',
    contextLength: 128000,
    maxImageSize: 4096,
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    externalKbCount: 11,
    capabilityTags: ['图像理解', 'OCR', '问答'],
  },
  {
    key: 'internvl2-4b',
    modelName: 'InternVL2.5-4B',
    modelCode: 'internvl2.5-4b',
    provider: 'InternLM',
    providerTone: 'internlm',
    contextLength: 64000,
    maxImageSize: 3072,
    endpoint: 'https://internlm.example.com/v1/chat/completions',
    externalKbCount: 3,
    capabilityTags: ['图片理解', '分类'],
  },
]

const DEFAULT_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#D8ECFF"/>
          <stop offset="55%" stop-color="#8CC7FF"/>
          <stop offset="100%" stop-color="#2E7CF6"/>
        </linearGradient>
      </defs>
      <rect width="640" height="480" fill="url(#sky)"/>
      <path d="M0 330 C90 290, 170 250, 260 260 C350 270, 420 330, 520 300 C570 284, 610 250, 640 240 L640 480 L0 480 Z" fill="#26684C" opacity="0.95"/>
      <path d="M0 360 C100 340, 180 320, 280 330 C390 342, 455 392, 560 372 C600 364, 628 344, 640 340 L640 480 L0 480 Z" fill="#1B4F7A" opacity="0.92"/>
      <rect x="410" y="282" width="98" height="58" rx="4" fill="#D5B48A"/>
      <path d="M400 284 L459 242 L518 284 Z" fill="#4B2F1A"/>
      <circle cx="505" cy="72" r="36" fill="#FFFFFF" opacity="0.25"/>
    </svg>
  `)

const MULTIMODAL_PAGE_STYLES = `
  .multimodal-settings-page {
    display: grid;
    gap: 8px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .multimodal-settings-tabs {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 40px;
    border-bottom: 1px solid ${BORDER_COLOR};
    overflow: hidden;
    white-space: nowrap;
  }

  .multimodal-settings-tab {
    position: relative;
    height: 40px;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${TEXT_MAIN};
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
  .multimodal-settings-tab--active { color: ${PRIMARY_COLOR}; font-weight: 600; }
  .multimodal-settings-tab--active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; border-radius: 999px; background: ${PRIMARY_COLOR}; }
  .multimodal-settings-layout {
    display: grid;
    grid-template-columns: minmax(340px, 0.95fr) minmax(660px, 2.05fr);
    gap: 10px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .multimodal-settings-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.035);
    overflow: hidden;
    background: #FFFFFF;
  }

  .multimodal-settings-panel > .ant-card-head {
    min-height: 0;
    padding: 8px 12px 0;
    border-bottom: none;
  }

  .multimodal-settings-panel > .ant-card-head .ant-card-head-title {
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${TEXT_MAIN};
  }

  .multimodal-settings-panel > .ant-card-body {
    display: grid;
    flex: 1;
    gap: 8px;
    min-height: 0;
    padding: 8px 12px 10px;
  }
  .multimodal-settings-list-card > .ant-card-body { grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; }
  .multimodal-settings-toolbar { display: flex; align-items: center; gap: 7px; }
  .multimodal-settings-toolbar .ant-input-affix-wrapper { height: 30px; border-radius: 6px; }
  .multimodal-settings-primary-btn { height: 30px; padding: 0 12px; border-radius: 6px; border-color: ${PRIMARY_COLOR}; background: ${PRIMARY_COLOR}; box-shadow: none; font-weight: 500; }
  .multimodal-settings-primary-btn:hover, .multimodal-settings-primary-btn:focus { border-color: #0E42D2 !important; background: #0E42D2 !important; }
  .multimodal-settings-list { display: grid; gap: 6px; min-height: 0; align-content: start; }
  .multimodal-settings-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 60px; padding: 6px 8px; border: 1px solid ${BORDER_COLOR}; border-radius: 8px; background: #FFFFFF; cursor: pointer; transition: all 0.2s ease; text-align: left; }
  .multimodal-settings-item:hover { border-color: rgba(22, 93, 255, 0.35); box-shadow: 0 8px 16px rgba(22, 93, 255, 0.08); }
  .multimodal-settings-item--active { border-color: ${PRIMARY_COLOR}; background: linear-gradient(180deg, rgba(22, 93, 255, 0.05), rgba(22, 93, 255, 0.02)); box-shadow: 0 8px 18px rgba(22, 93, 255, 0.10); }
  .multimodal-settings-logo { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #FFFFFF; font-size: 16px; font-weight: 700; box-shadow: inset 0 -12px 22px rgba(255, 255, 255, 0.16); flex: none; }
  .multimodal-settings-logo--openai { background: linear-gradient(180deg, rgba(16, 163, 127, 0.88), #10A37F); }
  .multimodal-settings-logo--qwen { background: linear-gradient(180deg, #8C5CFF, #722ED1); }
  .multimodal-settings-logo--google { background: linear-gradient(135deg, #4285F4 0 25%, #EA4335 25% 50%, #FBBC05 50% 75%, #34A853 75% 100%); }
  .multimodal-settings-logo--zhipu { background: linear-gradient(180deg, #4FA3FF, #1677FF); }
  .multimodal-settings-logo--internlm { background: linear-gradient(180deg, #9B7BFF, #7B61FF); }
  .multimodal-settings-item__content { min-width: 0; }
  .multimodal-settings-item__title-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .multimodal-settings-item__title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 1.2; font-weight: 600; color: ${TEXT_MAIN}; }
  .multimodal-settings-item__meta { margin-top: 1px; display: flex; flex-wrap: wrap; gap: 6px; font-size: 12px; line-height: 1.2; color: ${TEXT_MUTED}; }
  .multimodal-settings-item__tags { margin-top: 3px; display: flex; flex-wrap: wrap; gap: 5px; }
  .multimodal-settings-tag { padding: 0 7px; border-radius: 2px; background: #F2F3F5; color: ${TEXT_SECONDARY}; font-size: 12px; line-height: 16px; }
  .multimodal-settings-item__actions { display: flex; align-items: center; gap: 5px; }
  .multimodal-settings-icon-btn { width: 26px; height: 26px; border: 1px solid ${BORDER_COLOR}; border-radius: 50%; background: #FFFFFF; color: ${PRIMARY_COLOR}; box-shadow: none; }
  .multimodal-settings-icon-btn:hover, .multimodal-settings-icon-btn:focus { border-color: ${PRIMARY_COLOR} !important; color: ${PRIMARY_COLOR} !important; background: rgba(22, 93, 255, 0.06) !important; }
  .multimodal-settings-pagination { display: flex; justify-content: center; padding-top: 0; min-height: 26px; }
  .multimodal-settings-pagination .ant-pagination-item, .multimodal-settings-pagination .ant-pagination-prev, .multimodal-settings-pagination .ant-pagination-next { min-width: 26px; height: 26px; line-height: 24px; border-radius: 6px; }
  .multimodal-settings-right-stack { display: grid; gap: 7px; min-height: 0; }
  .multimodal-settings-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: ${TEXT_MAIN}; }
  .multimodal-settings-section-title::before { content: ''; width: 3px; height: 14px; border-radius: 999px; background: ${PRIMARY_COLOR}; }
  .multimodal-settings-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; }
  .multimodal-settings-field .ant-input, .multimodal-settings-field .ant-input-affix-wrapper, .multimodal-settings-field .ant-select-selector, .multimodal-settings-field .ant-input-number { min-height: 28px !important; height: 28px !important; border-radius: 6px !important; }
  .multimodal-settings-label { display: flex; align-items: center; gap: 5px; margin-bottom: 3px; font-size: 12px; font-weight: 500; color: ${TEXT_MAIN}; }
  .multimodal-settings-label__required { color: #F53F3F; }
  .multimodal-settings-full { grid-column: 1 / -1; }
  .multimodal-settings-number-wrap { position: relative; }
  .multimodal-settings-number-wrap .ant-input-number { width: 100%; }
  .multimodal-settings-number-unit { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: ${TEXT_MUTED}; font-size: 11px; pointer-events: none; }
  .multimodal-settings-status { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 1px solid ${BORDER_COLOR}; border-radius: 6px; background: #FFFFFF; color: ${TEXT_SECONDARY}; font-size: 12px; flex-wrap: wrap; }
  .multimodal-settings-status__item { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .multimodal-settings-status__dot { width: 8px; height: 8px; border-radius: 50%; background: ${SUCCESS_COLOR}; box-shadow: 0 0 0 3px rgba(0, 180, 42, 0.12); flex: none; }
  .multimodal-settings-status__success { color: ${SUCCESS_COLOR}; font-weight: 600; }
  .multimodal-settings-status__tag { color: ${PRIMARY_COLOR}; font-weight: 600; }
  .multimodal-settings-capability-list { display: flex; flex-wrap: wrap; gap: 5px; }
  .multimodal-settings-capability { padding: 0 7px; line-height: 16px; border-radius: 2px; background: rgba(22, 93, 255, 0.08); color: ${PRIMARY_COLOR}; font-size: 11px; font-weight: 500; }
  .multimodal-settings-workbench { display: grid; grid-template-columns: minmax(210px, 0.7fr) minmax(0, 1.3fr); gap: 8px; align-items: start; }
  .multimodal-settings-media { display: grid; gap: 6px; }
  .multimodal-settings-upload { padding: 8px !important; border: 1px dashed #C9CDD4 !important; border-radius: 6px !important; background: #FBFCFE !important; }
  .multimodal-settings-upload__title { margin-top: 4px; font-size: 12px; color: ${TEXT_SECONDARY}; }
  .multimodal-settings-upload__desc { margin-top: 2px; font-size: 11px; color: ${TEXT_MUTED}; }
  .multimodal-settings-preview { position: relative; overflow: hidden; border-radius: 6px; border: 1px solid ${BORDER_COLOR}; background: #FBFCFE; min-height: 188px; }
  .multimodal-settings-preview img { display: block; width: 100%; height: 188px; object-fit: cover; }
  .multimodal-settings-preview__remove { position: absolute; top: 6px; right: 6px; width: 24px; height: 24px; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.52); color: #FFFFFF; cursor: pointer; z-index: 2; }
  .multimodal-settings-side { display: grid; gap: 7px; min-height: 0; }
  .multimodal-settings-testrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
  .multimodal-settings-testrow .ant-input-affix-wrapper { min-height: 32px; border-radius: 6px; }
  .multimodal-settings-send-btn { width: 36px; height: 32px; border-radius: 6px; border-color: ${PRIMARY_COLOR}; background: ${PRIMARY_COLOR}; box-shadow: none; }
  .multimodal-settings-scenes { display: flex; flex-wrap: wrap; gap: 5px; }
  .multimodal-settings-scene-btn { height: 22px; padding: 0 8px; border-radius: 2px; border-color: #E5E6EB; background: #F2F3F5; color: ${TEXT_SECONDARY}; font-size: 12px; box-shadow: none; }
  .multimodal-settings-results { display: grid; gap: 6px; padding: 8px; border: 1px solid ${BORDER_COLOR}; border-radius: 6px; background: #F7F8FA; }
  .multimodal-settings-result { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 6px; align-items: start; padding: 6px 8px; border-radius: 6px; background: #FFFFFF; border: 1px solid rgba(229, 230, 235, 0.8); }
  .multimodal-settings-result__icon { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; color: #FFFFFF; font-size: 11px; font-weight: 700; flex: none; }
  .multimodal-settings-result__title { font-size: 11px; font-weight: 600; color: ${TEXT_MAIN}; line-height: 1.3; }
  .multimodal-settings-result__text { margin-top: 1px; font-size: 11px; color: ${TEXT_SECONDARY}; line-height: 1.35; }
  .multimodal-settings-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .multimodal-settings-save-btn { min-width: 112px; height: 30px; border-radius: 6px; border-color: ${PRIMARY_COLOR}; background: ${PRIMARY_COLOR}; box-shadow: none; font-weight: 500; }
  .multimodal-settings-border-btn { min-width: 126px; height: 30px; border-radius: 6px; border-color: ${PRIMARY_COLOR}; color: ${PRIMARY_COLOR}; background: #FFFFFF; box-shadow: none; font-weight: 500; }
  .multimodal-settings-default-btn { min-width: 100px; height: 30px; border-radius: 6px; border-color: ${BORDER_COLOR}; color: ${TEXT_SECONDARY}; background: #FFFFFF; box-shadow: none; font-weight: 500; }
  .multimodal-settings-note { display: flex; align-items: flex-start; gap: 6px; color: ${TEXT_MUTED}; font-size: 11px; line-height: 1.25; }
  .multimodal-settings-modal .ant-modal-content { border-radius: 14px; overflow: hidden; }
  .multimodal-settings-panel .ant-form-item { margin-bottom: 0; }
  .multimodal-settings-panel .ant-form-item-label { padding-bottom: 0; }
  .multimodal-settings-panel .ant-form-item-explain { min-height: 0; }
  .multimodal-settings-modal__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .multimodal-settings-modal__field { display: grid; gap: 6px; }
  .multimodal-settings-modal__label { font-size: 14px; color: ${TEXT_MAIN}; font-weight: 500; }
  .multimodal-settings-modal__required { color: #F53F3F; }
  @media (max-width: 1280px) { .multimodal-settings-layout { grid-template-columns: 1fr; } }
  @media (max-width: 900px) {
    .multimodal-settings-form-grid, .multimodal-settings-modal__grid, .multimodal-settings-workbench { grid-template-columns: 1fr; }
    .multimodal-settings-toolbar { flex-direction: column; align-items: stretch; }
    .multimodal-settings-item { grid-template-columns: auto minmax(0, 1fr); }
    .multimodal-settings-item__actions { grid-column: 1 / -1; justify-content: flex-end; }
    .multimodal-settings-page { height: auto; }
  }
`

function buildResultBlocks(testResult?: MultimodalConfigPageProps['testResult'] | null): ResultBlock[] {
  return [
    { key: 'caption', title: '图片描述', color: '#00B42A', text: testResult?.caption ?? '画面包含湖泊、雪山、栈道与亭台，整体风景开阔清晰。' },
    { key: 'ocr', title: '识别文字', color: '#1677FF', text: testResult?.ocrText ?? '识别到的文字：九寨沟风景区欢迎您' },
    { key: 'answer', title: '模型回答', color: '#722ED1', text: testResult?.modelAnswer ?? '该图片展示了九寨沟自然景区，具备典型山水风光与旅游景区设施。' },
  ]
}

export default function MultimodalConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onOpenManual,
  onSave,
  onTest,
  result,
  testResult,
}: MultimodalConfigPageProps) {
  const [configForm] = Form.useForm<MultimodalModelFormValues>()
  const [createForm] = Form.useForm<CreateMultimodalModelValues>()
  const [searchText, setSearchText] = useState('')
  const [selectedKey, setSelectedKey] = useState(BASE_MODELS[0].key)
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [promptText, setPromptText] = useState('请输入测试问题，例如：请识别图片中的景点并简要介绍')
  const [imageDataUrl, setImageDataUrl] = useState(DEFAULT_IMAGE)
  const [mode, setMode] = useState<'caption' | 'ocr' | 'reason' | 'summary' | 'qa'>('caption')

  const allModels = useMemo(() => BASE_MODELS, [])
  const selectedModelValue = Form.useWatch('multimodalModel', form)
  const currentOption = options.find((item) => item.value === selectedModelValue)

  const filteredModels = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return allModels
    return allModels.filter((item) => (
      item.modelName.toLowerCase().includes(keyword)
      || item.modelCode.toLowerCase().includes(keyword)
      || item.provider.toLowerCase().includes(keyword)
      || item.capabilityTags.some((tag) => tag.toLowerCase().includes(keyword))
    ))
  }, [allModels, searchText])

  const pagedModels = useMemo(() => filteredModels.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredModels, page])
  const selectedModel = useMemo(() => allModels.find((item) => item.key === selectedKey) ?? allModels[0], [allModels, selectedKey])
  const resultBlocks = useMemo(() => buildResultBlocks(testResult), [testResult])
  const providerOptions = useMemo(() => Array.from(new Set(allModels.map((item) => item.provider))).map((provider) => ({ label: provider, value: provider })), [allModels])

  useEffect(() => {
    if (!selectedModelValue && BASE_MODELS[0]) {
      form.setFieldValue('multimodalModel', BASE_MODELS[0].modelCode)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Ant Design form initialization must synchronize the selected card
      setSelectedKey(BASE_MODELS[0].key)
    }
  }, [form, selectedModelValue])

  useEffect(() => {
    if (!selectedModel) return
    configForm.setFieldsValue({
      modelName: selectedModel.modelName,
      modelCode: selectedModel.modelCode,
      provider: selectedModel.provider,
      contextLength: selectedModel.contextLength,
      maxImageSize: selectedModel.maxImageSize,
      endpoint: selectedModel.endpoint,
    })
  }, [configForm, selectedModel])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- search changes reset controlled pagination
    setPage(1)
  }, [searchText])
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE))
    if (page > totalPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- result shrinkage clamps controlled pagination to a valid page
      setPage(totalPages)
    }
  }, [filteredModels.length, page])

  const handleSelectModel = (model: MultimodalModelRecord) => {
    setSelectedKey(model.key)
    form.setFieldValue('multimodalModel', model.modelCode)
  }

  const handlePlay = (model: MultimodalModelRecord) => {
    handleSelectModel(model)
    onTest({ promptText, imageDataUrl, mode })
  }

  const uploadProps: UploadProps = {
    accept: '.png,.jpg,.jpeg,.webp',
    showUploadList: false,
    beforeUpload: async (file) => {
      const reader = new FileReader()
      reader.onload = () => setImageDataUrl(String(reader.result ?? ''))
      reader.readAsDataURL(file)
      return false
    },
  }

  const handleSend = () => {
    const value = promptText.trim()
    if (!value) return
    onTest({ promptText: value, imageDataUrl, mode })
  }

  const handleSave = async () => { await configForm.validateFields(); onSave() }
  const handleReset = () => {
    configForm.setFieldsValue({
      modelName: selectedModel.modelName,
      modelCode: selectedModel.modelCode,
      provider: selectedModel.provider,
      contextLength: selectedModel.contextLength,
      maxImageSize: selectedModel.maxImageSize,
      endpoint: selectedModel.endpoint,
    })
    setPromptText('请输入测试问题，例如：请识别图片中的景点并简要介绍')
    setImageDataUrl(DEFAULT_IMAGE)
    setMode('caption')
  }
  const handleCreateModel = async () => {
    await createForm.validateFields()
    onOpenManual()
  }

  return (
    <div className="multimodal-settings-page">
      <style>{MULTIMODAL_PAGE_STYLES}</style>
      <div className="multimodal-settings-layout">
        <Card title="多模态模型列表" className="multimodal-settings-panel multimodal-settings-list-card">
          <div className="multimodal-settings-toolbar">
            <Input
              allowClear
              placeholder="搜索模型名称或标识"
              prefix={<SearchOutlined style={{ color: TEXT_MUTED }} />}
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />} className="multimodal-settings-primary-btn" onClick={onOpenManual}>
              手动维护
            </Button>
          </div>
          <div className="multimodal-settings-list">
            {pagedModels.map((item) => {
              const active = item.key === selectedKey
              const theme = PROVIDER_THEME[item.providerTone]
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`multimodal-settings-item ${active ? 'multimodal-settings-item--active' : ''}`}
                  onClick={() => handleSelectModel(item)}
                >
                  <div className={`multimodal-settings-logo multimodal-settings-logo--${item.providerTone}`} style={{ background: theme.color }}>
                    {theme.icon}
                  </div>
                  <div className="multimodal-settings-item__content">
                    <div className="multimodal-settings-item__title-row">
                      <div className="multimodal-settings-item__title">{item.modelName}</div>
                      {item.featuredLabel ? <Tag color="blue">{item.featuredLabel}</Tag> : null}
                    </div>
                    <div className="multimodal-settings-item__meta">
                      <span>提供方：{item.provider}</span>
                      <span>{item.contextLength.toLocaleString()} 上下文</span>
                    </div>
                    <div className="multimodal-settings-item__tags">
                      {item.capabilityTags.map((tag) => (
                        <span key={tag} className="multimodal-settings-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="multimodal-settings-item__actions" onClick={(event) => event.stopPropagation()}>
                    <Button type="text" shape="circle" className="multimodal-settings-icon-btn" icon={<PlayCircleOutlined />} onClick={() => handlePlay(item)} />
                  </div>
                </button>
              )
            })}
          </div>
          <Pagination className="multimodal-settings-pagination" current={page} pageSize={PAGE_SIZE} total={filteredModels.length} size="small" hideOnSinglePage={false} showSizeChanger={false} onChange={setPage} />
        </Card>
        <Card title="模型配置" className="multimodal-settings-panel">
          <div className="multimodal-settings-right-stack">
            <div>
              <div className="multimodal-settings-section-title">基本信息</div>
              <Form form={configForm} layout="vertical" requiredMark={false} disabled={loading} className="multimodal-settings-form-grid">
                <Form.Item className="multimodal-settings-field" name="modelName" rules={[{ required: true, message: '请输入模型名称' }]} label={<span className="multimodal-settings-label">模型名称 <span className="multimodal-settings-label__required">*</span></span>}>
                  <Input placeholder="请输入模型名称" />
                </Form.Item>
                <Form.Item className="multimodal-settings-field" name="modelCode" rules={[{ required: true, message: '请输入模型标识' }]} label={<span className="multimodal-settings-label">模型标识 <span className="multimodal-settings-label__required">*</span></span>}>
                  <Input placeholder="请输入模型标识" />
                </Form.Item>
                <Form.Item className="multimodal-settings-field" name="provider" rules={[{ required: true, message: '请选择服务提供方' }]} label={<span className="multimodal-settings-label">服务提供方 <span className="multimodal-settings-label__required">*</span></span>}>
                  <Select placeholder="请选择服务提供方" options={providerOptions} />
                </Form.Item>
                <Form.Item className="multimodal-settings-field" name="contextLength" rules={[{ required: true, message: '请输入上下文长度' }]} label={<span className="multimodal-settings-label">上下文长度 <span className="multimodal-settings-label__required">*</span></span>}>
                  <div className="multimodal-settings-number-wrap">
                    <InputNumber controls min={1} max={1000000} style={{ width: '100%' }} />
                    <span className="multimodal-settings-number-unit">tokens</span>
                  </div>
                </Form.Item>
                <Form.Item className="multimodal-settings-field" name="maxImageSize" rules={[{ required: true, message: '请输入最大图片尺寸' }]} label={<span className="multimodal-settings-label">最大图片尺寸 <span className="multimodal-settings-label__required">*</span></span>}>
                  <div className="multimodal-settings-number-wrap">
                    <InputNumber controls min={1} max={10000} style={{ width: '100%' }} />
                    <span className="multimodal-settings-number-unit">px</span>
                  </div>
                </Form.Item>
                <Form.Item className="multimodal-settings-field multimodal-settings-full" name="endpoint" rules={[{ required: true, message: '请输入接口地址' }]} label={<span className="multimodal-settings-label">接口地址 <span className="multimodal-settings-label__required">*</span></span>}>
                  <Input placeholder="请输入接口地址" />
                </Form.Item>
              </Form>

              <div className="multimodal-settings-status">
                <div className="multimodal-settings-status__item">
                  <span className="multimodal-settings-status__dot" />
                  <span>连接状态：</span>
                  <span className="multimodal-settings-status__success">已连接</span>
                </div>
                <div className="multimodal-settings-status__item">
                  <span>第三方知识源：</span>
                  <span className="multimodal-settings-status__tag">{selectedModel.externalKbCount}</span>
                </div>
                <div className="multimodal-settings-status__item">
                  <span>能力标签：</span>
                  <div className="multimodal-settings-capability-list">
                    {['图文联合理解', 'OCR', '问答', '推理'].map((tag) => (
                      <span key={tag} className="multimodal-settings-capability">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="multimodal-settings-status__item">
                  <span>当前提供方：</span>
                  <span>{currentOption?.provider ?? selectedModel.provider}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="multimodal-settings-section-title">多模态测试</div>
              <div className="multimodal-settings-workbench">
                <div className="multimodal-settings-media">
                  <Upload.Dragger {...uploadProps} className="multimodal-settings-upload">
                    <UploadOutlined style={{ fontSize: 18, color: PRIMARY_COLOR }} />
                    <div className="multimodal-settings-upload__title">点击或拖拽上传测试图片</div>
                    <div className="multimodal-settings-upload__desc">支持 JPG / PNG / WEBP，建议用于视觉理解、OCR 与问答测试</div>
                  </Upload.Dragger>
                  <div className="multimodal-settings-preview">
                    <button type="button" className="multimodal-settings-preview__remove" onClick={() => setImageDataUrl(DEFAULT_IMAGE)}>×</button>
                    <img src={imageDataUrl} alt="多模态测试预览" />
                  </div>
                </div>
                <div className="multimodal-settings-side">
                  <div className="multimodal-settings-testrow">
                    <Input
                      value={promptText}
                      onChange={(event) => setPromptText(event.target.value)}
                      placeholder="输入测试问题，例如：请识别图片中的景点并简要介绍"
                    />
                    <Button type="primary" className="multimodal-settings-send-btn" icon={<SendOutlined />} onClick={handleSend} />
                  </div>
                  <div className="multimodal-settings-scenes">
                    {QUICK_TAGS.map((tag) => (
                      <Button
                        key={tag}
                        className="multimodal-settings-scene-btn"
                        onClick={() => {
                          const map: Record<string, string> = {
                            '图片问答': '请问这张图片里展示了什么景点？',
                            'OCR 识别': '请提取图片中的文字内容。',
                            '场景理解': '请分析这张图片的场景和氛围。',
                            '内容总结': '请对图片内容做一个简要总结。',
                          }
                          setMode(tag === '图片问答' ? 'qa' : tag === 'OCR 识别' ? 'ocr' : tag === '场景理解' ? 'reason' : 'summary')
                          setPromptText(map[tag])
                        }}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                  <div className="multimodal-settings-results">
                    {resultBlocks.map((block) => (
                      <div key={block.key} className="multimodal-settings-result">
                        <span className="multimodal-settings-result__icon" style={{ background: block.color }}>
                          {block.key === 'caption' ? '图' : block.key === 'ocr' ? '文' : '答'}
                        </span>
                        <div>
                          <div className="multimodal-settings-result__title">{block.title}</div>
                          <div className="multimodal-settings-result__text">{block.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="multimodal-settings-actions">
              <Button type="primary" className="multimodal-settings-save-btn" loading={saving} onClick={() => void handleSave()}>保存设置</Button>
              <Button className="multimodal-settings-border-btn" loading={testing} onClick={() => onTest({ promptText, imageDataUrl, mode })}>测试当前模型</Button>
              <Button className="multimodal-settings-default-btn" onClick={handleReset}>重置表单</Button>
            </div>

            <div className="multimodal-settings-note">
              <InfoCircleOutlined />
              <span>提示：多模态模型用于图像理解、OCR 识别、视觉问答、图文联合推理等多模态场景</span>
            </div>

            {result ? <div style={{ display: 'none' }}>{result}</div> : null}
          </div>
        </Card>
      </div>

      <Modal
        open={addOpen}
        title="新增模型"
        destroyOnClose
        className="multimodal-settings-modal"
        onCancel={() => setAddOpen(false)}
        footer={[
          <Button key="manual" onClick={onOpenManual}>去手动维护</Button>,
          <Button key="cancel" onClick={() => setAddOpen(false)}>取消</Button>,
          <Button key="confirm" type="primary" onClick={() => void handleCreateModel()}>确认新增</Button>,
        ]}
      >
        <Form
          form={createForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ provider: 'OpenAI', contextLength: 128000, maxImageSize: 4096, endpoint: 'https://api.openai.com/v1/chat/completions' }}
          className="multimodal-settings-modal__grid"
        >
          <Form.Item className="multimodal-settings-modal__field" name="modelName" rules={[{ required: true, message: '请输入模型名称' }]} label={<span className="multimodal-settings-modal__label">模型名称 <span className="multimodal-settings-modal__required">*</span></span>}>
            <Input placeholder="请输入模型名称" />
          </Form.Item>
          <Form.Item className="multimodal-settings-modal__field" name="modelCode" rules={[{ required: true, message: '请输入模型标识' }]} label={<span className="multimodal-settings-modal__label">模型标识 <span className="multimodal-settings-modal__required">*</span></span>}>
            <Input placeholder="请输入模型标识" />
          </Form.Item>
          <Form.Item className="multimodal-settings-modal__field" name="provider" rules={[{ required: true, message: '请选择服务提供方' }]} label={<span className="multimodal-settings-modal__label">服务提供方 <span className="multimodal-settings-modal__required">*</span></span>}>
            <Select placeholder="请选择服务提供方" options={providerOptions} />
          </Form.Item>
          <Form.Item className="multimodal-settings-modal__field" name="contextLength" rules={[{ required: true, message: '请输入上下文长度' }]} label={<span className="multimodal-settings-modal__label">上下文长度 <span className="multimodal-settings-modal__required">*</span></span>}>
            <InputNumber controls min={1} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item className="multimodal-settings-modal__field" name="maxImageSize" rules={[{ required: true, message: '请输入最大图片尺寸' }]} label={<span className="multimodal-settings-modal__label">最大图片尺寸 <span className="multimodal-settings-modal__required">*</span></span>}>
            <InputNumber controls min={1} max={10000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item className="multimodal-settings-modal__field multimodal-settings-full" name="endpoint" rules={[{ required: true, message: '请输入接口地址' }]} label={<span className="multimodal-settings-modal__label">接口地址 <span className="multimodal-settings-modal__required">*</span></span>}>
            <Input placeholder="请输入接口地址" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
