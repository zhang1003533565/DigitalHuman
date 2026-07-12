import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  InfoCircleOutlined,
  PlusOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  SendOutlined,
} from '@ant-design/icons'
import { Button, Card, Form, Input, InputNumber, Modal, Pagination, Select } from 'antd'
import type { FormInstance } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type ChatOption = {
  value: string
  provider?: string
}

type ChatConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: ChatOption[]
  onOpenManual: () => void
  onSave: () => void
  onTest: (payload?: { promptText?: string }) => void
  result: ReactNode
}

type ProviderTone = 'deepseek' | 'openai' | 'qwen' | 'zhipu' | 'moonshot'

interface ChatModelRecord {
  key: string
  modelName: string
  modelCode: string
  provider: string
  providerTone: ProviderTone
  contextLength: number
  maxOutput: number
  endpoint: string
  purposeTags: string[]
  featuredLabel?: string
  temperature: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

interface ChatModelFormValues {
  modelName: string
  modelCode: string
  provider: string
  contextLength: number
  maxOutput: number
  endpoint: string
  temperature: number
  topP: number
  frequencyPenalty: number
  presencePenalty: number
}

interface CreateChatModelValues {
  modelName: string
  modelCode: string
  provider: string
  contextLength: number
  maxOutput: number
  endpoint: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const PRIMARY_COLOR = '#165DFF'
const SUCCESS_COLOR = '#00B42A'
const TEXT_MAIN = '#1D2129'
const TEXT_SECONDARY = '#4E5969'
const TEXT_MUTED = '#86909C'
const BORDER_COLOR = '#E5E6EB'

const PAGE_SIZE = 5

const PROVIDER_THEME: Record<ProviderTone, { color: string; icon: string }> = {
  deepseek: { color: '#1677FF', icon: 'D' },
  openai: { color: '#36B37E', icon: 'O' },
  qwen: { color: '#722ED1', icon: 'Q' },
  zhipu: { color: '#FF7D00', icon: 'Z' },
  moonshot: { color: '#36CFC9', icon: 'M' },
}

const CHAT_TEST_SCENES = ['景点介绍', '路线推荐', '游客问答', '多轮对话']

const CHAT_MODELS: ChatModelRecord[] = [
  {
    key: 'deepseek-v4-pro',
    modelName: 'deepseek-v4-pro',
    modelCode: 'deepseek-v4-pro',
    provider: 'DeepSeek',
    providerTone: 'deepseek',
    contextLength: 128000,
    maxOutput: 4096,
    endpoint: 'http://localhost:8000/v1/chat/completions',
    purposeTags: ['导游问答', '智能客服'],
    featuredLabel: '当前使用',
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'gpt-4.1',
    modelName: 'gpt-4.1',
    modelCode: 'gpt-4.1',
    provider: 'OpenAI',
    providerTone: 'openai',
    contextLength: 128000,
    maxOutput: 4096,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    purposeTags: ['复杂推理', '知识问答'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'qwen-max',
    modelName: 'qwen-max',
    modelCode: 'qwen-max',
    provider: 'Qwen',
    providerTone: 'qwen',
    contextLength: 32000,
    maxOutput: 4096,
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    purposeTags: ['通用对话', '中文优化'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'glm-4.5',
    modelName: 'glm-4.5',
    modelCode: 'glm-4.5',
    provider: '智谱 AI',
    providerTone: 'zhipu',
    contextLength: 128000,
    maxOutput: 4096,
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    purposeTags: ['讲解助手', '文案生成'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'kimi-k2.5',
    modelName: 'kimi-k2.5',
    modelCode: 'kimi-k2.5',
    provider: 'Moonshot',
    providerTone: 'moonshot',
    contextLength: 200000,
    maxOutput: 4096,
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    purposeTags: ['长文总结', '对话辅助'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'deepseek-r1',
    modelName: 'deepseek-r1',
    modelCode: 'deepseek-r1',
    provider: 'DeepSeek',
    providerTone: 'deepseek',
    contextLength: 64000,
    maxOutput: 4096,
    endpoint: 'http://localhost:8000/v1/chat/completions',
    purposeTags: ['复杂推理', '知识问答'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'gpt-4o-mini',
    modelName: 'gpt-4o-mini',
    modelCode: 'gpt-4o-mini',
    provider: 'OpenAI',
    providerTone: 'openai',
    contextLength: 128000,
    maxOutput: 4096,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    purposeTags: ['智能客服', '游客咨询'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'qwen-plus',
    modelName: 'qwen-plus',
    modelCode: 'qwen-plus',
    provider: 'Qwen',
    providerTone: 'qwen',
    contextLength: 64000,
    maxOutput: 4096,
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    purposeTags: ['导游问答', '多轮对话'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'glm-4-air',
    modelName: 'glm-4-air',
    modelCode: 'glm-4-air',
    provider: '智谱 AI',
    providerTone: 'zhipu',
    contextLength: 64000,
    maxOutput: 4096,
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    purposeTags: ['景区介绍', '路线推荐'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'moonshot-v1-32k',
    modelName: 'moonshot-v1-32k',
    modelCode: 'moonshot-v1-32k',
    provider: 'Moonshot',
    providerTone: 'moonshot',
    contextLength: 32000,
    maxOutput: 4096,
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    purposeTags: ['长文总结', '知识问答'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'deepseek-v3.1',
    modelName: 'deepseek-v3.1',
    modelCode: 'deepseek-v3.1',
    provider: 'DeepSeek',
    providerTone: 'deepseek',
    contextLength: 128000,
    maxOutput: 4096,
    endpoint: 'http://localhost:8000/v1/chat/completions',
    purposeTags: ['导游问答', '知识问答'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'gpt-4.1-mini',
    modelName: 'gpt-4.1-mini',
    modelCode: 'gpt-4.1-mini',
    provider: 'OpenAI',
    providerTone: 'openai',
    contextLength: 128000,
    maxOutput: 4096,
    endpoint: 'https://api.openai.com/v1/chat/completions',
    purposeTags: ['智能客服', '游客咨询'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
  {
    key: 'kimi-k1',
    modelName: 'kimi-k1',
    modelCode: 'kimi-k1',
    provider: 'Moonshot',
    providerTone: 'moonshot',
    contextLength: 200000,
    maxOutput: 4096,
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    purposeTags: ['多轮对话', '长文总结'],
    temperature: 0.7,
    topP: 0.9,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
]

const CHAT_PAGE_STYLES = `
  .chat-config-page {
    display: grid;
    gap: 8px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .chat-config-layout {
    display: grid;
    grid-template-columns: minmax(340px, 0.9fr) minmax(620px, 2.1fr);
    gap: 10px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .chat-config-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.035);
    overflow: hidden;
    background: #FFFFFF;
  }

  .chat-config-panel > .ant-card-head {
    min-height: 0;
    padding: 8px 12px 0;
    border-bottom: none;
  }

  .chat-config-panel > .ant-card-head .ant-card-head-title {
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${TEXT_MAIN};
  }

  .chat-config-panel > .ant-card-body {
    display: grid;
    flex: 1;
    gap: 8px;
    min-height: 0;
    padding: 8px 12px 10px;
  }

  .chat-config-list-card > .ant-card-body {
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
  }

  .chat-config-toolbar {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .chat-config-toolbar .ant-input-affix-wrapper {
    height: 30px;
    border-radius: 6px;
  }

  .chat-config-primary-btn {
    height: 30px;
    padding: 0 12px;
    border-radius: 6px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
    font-weight: 500;
  }

  .chat-config-primary-btn:hover,
  .chat-config-primary-btn:focus {
    border-color: #0E42D2 !important;
    background: #0E42D2 !important;
  }

  .chat-config-list {
    display: grid;
    gap: 6px;
    min-height: 0;
    align-content: start;
  }

  .chat-config-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    min-height: 62px;
    padding: 6px 8px;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 8px;
    background: #FFFFFF;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
  }

  .chat-config-item:hover {
    border-color: rgba(22, 93, 255, 0.35);
    box-shadow: 0 8px 16px rgba(22, 93, 255, 0.08);
  }

  .chat-config-item--active {
    border-color: ${PRIMARY_COLOR};
    background: linear-gradient(180deg, rgba(22, 93, 255, 0.05), rgba(22, 93, 255, 0.02));
    box-shadow: 0 8px 18px rgba(22, 93, 255, 0.10);
  }

  .chat-config-avatar {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #FFFFFF;
    font-size: 16px;
    font-weight: 700;
    box-shadow: inset 0 -12px 22px rgba(255, 255, 255, 0.16);
    flex: none;
  }

  .chat-config-avatar--deepseek { background: linear-gradient(180deg, #4FA3FF, #1677FF); }
  .chat-config-avatar--openai { background: linear-gradient(180deg, #52C28A, #36B37E); }
  .chat-config-avatar--qwen { background: linear-gradient(180deg, #8C5CFF, #722ED1); }
  .chat-config-avatar--zhipu { background: linear-gradient(180deg, #FFAB52, #FF7D00); }
  .chat-config-avatar--moonshot { background: linear-gradient(180deg, #6BE2DE, #36CFC9); }

  .chat-config-item__content {
    min-width: 0;
  }

  .chat-config-item__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .chat-config-item__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 1.2;
    font-weight: 600;
    color: ${TEXT_MAIN};
  }

  .chat-config-item__badge {
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(22, 93, 255, 0.10);
    color: ${PRIMARY_COLOR};
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
  }

  .chat-config-item__meta {
    margin-top: 1px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
    line-height: 1.2;
    color: ${TEXT_MUTED};
  }

  .chat-config-item__purpose {
    margin-top: 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .chat-config-purpose-tag {
    padding: 0 7px;
    border-radius: 2px;
    background: #F2F3F5;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    line-height: 16px;
  }

  .chat-config-item__actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .chat-config-icon-btn {
    width: 26px;
    height: 26px;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 50%;
    background: #FFFFFF;
    color: ${PRIMARY_COLOR};
    box-shadow: none;
  }

  .chat-config-icon-btn:hover,
  .chat-config-icon-btn:focus {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.06) !important;
  }

  .chat-config-pagination {
    display: flex;
    justify-content: center;
    padding-top: 0;
  }

  .chat-config-pagination .ant-pagination-item,
  .chat-config-pagination .ant-pagination-prev,
  .chat-config-pagination .ant-pagination-next {
    min-width: 26px;
    height: 26px;
    line-height: 24px;
    border-radius: 6px;
  }

  .chat-config-right-stack {
    display: grid;
    gap: 6px;
    min-height: 0;
  }

  .chat-config-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .chat-config-section-title::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 999px;
    background: ${PRIMARY_COLOR};
  }

  .chat-config-form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 10px;
  }

  .chat-config-field .ant-input,
  .chat-config-field .ant-input-affix-wrapper,
  .chat-config-field .ant-select-selector,
  .chat-config-field .ant-input-number {
    min-height: 28px !important;
    height: 28px !important;
    border-radius: 6px !important;
  }

  .chat-config-label {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
    font-size: 12px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .chat-config-label__required {
    color: #F53F3F;
  }

  .chat-config-full {
    grid-column: 1 / -1;
  }

  .chat-config-number-wrap {
    position: relative;
  }

  .chat-config-number-wrap .ant-input-number {
    width: 100%;
  }

  .chat-config-number-unit {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: ${TEXT_MUTED};
    font-size: 12px;
    pointer-events: none;
  }

  .chat-config-status {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 6px;
    background: #FFFFFF;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    flex-wrap: wrap;
  }

  .chat-config-status__item {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .chat-config-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${SUCCESS_COLOR};
    box-shadow: 0 0 0 3px rgba(0, 180, 42, 0.12);
    flex: none;
  }

  .chat-config-status__success {
    color: ${SUCCESS_COLOR};
    font-weight: 600;
  }

  .chat-config-status__tag {
    color: ${PRIMARY_COLOR};
    font-weight: 600;
  }

  .chat-config-params {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }

  .chat-config-param {
    display: grid;
    gap: 3px;
    padding: 6px 8px;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 6px;
    background: #FFFFFF;
  }

  .chat-config-param__label {
    font-size: 11px;
    color: ${TEXT_SECONDARY};
    font-weight: 500;
  }

  .chat-config-param .ant-input-number {
    width: 100%;
  }

  .chat-config-test {
    display: grid;
    gap: 6px;
  }

  .chat-config-testrow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
  }

  .chat-config-testrow .ant-input-affix-wrapper {
    min-height: 32px;
    border-radius: 6px;
  }

  .chat-config-send-btn {
    width: 36px;
    height: 32px;
    border-radius: 6px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
  }

  .chat-config-scenes {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .chat-config-scene-btn {
    height: 22px;
    padding: 0 8px;
    border-radius: 2px;
    border-color: #E5E6EB;
    background: #F2F3F5;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    box-shadow: none;
  }

  .chat-config-scene-btn:hover,
  .chat-config-scene-btn:focus {
    border-color: #D9DDE3 !important;
    background: #F7F8FA !important;
    color: ${TEXT_SECONDARY} !important;
  }

  .chat-config-history {
    display: grid;
    gap: 4px;
    padding: 6px;
    border: 1px solid ${BORDER_COLOR};
    border-radius: 6px;
    background: #F7F8FA;
    min-height: 132px;
  }

  .chat-config-message {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .chat-config-message--user {
    justify-content: flex-start;
  }

  .chat-config-message--assistant {
    justify-content: flex-end;
  }

  .chat-config-bubble {
    max-width: 82%;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.35;
  }

  .chat-config-bubble--user {
    background: ${PRIMARY_COLOR};
    color: #FFFFFF;
    border-bottom-left-radius: 4px;
  }

  .chat-config-bubble--assistant {
    background: #FFFFFF;
    color: ${TEXT_MAIN};
    border: 1px solid ${BORDER_COLOR};
    border-bottom-right-radius: 4px;
  }

  .chat-config-bubble__meta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-size: 12px;
    font-weight: 600;
  }

  .chat-config-bubble__avatar {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
    font-size: 12px;
    color: #FFFFFF;
    flex: none;
  }

  .chat-config-bubble__avatar--user {
    background: rgba(255, 255, 255, 0.18);
  }

  .chat-config-bubble__avatar--assistant {
    background: ${SUCCESS_COLOR};
  }

  .chat-config-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
  }

  .chat-config-save-btn {
    min-width: 112px;
    height: 30px;
    border-radius: 6px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
    font-weight: 500;
  }

  .chat-config-save-btn:hover,
  .chat-config-save-btn:focus {
    border-color: #0E42D2 !important;
    background: #0E42D2 !important;
  }

  .chat-config-border-btn {
    min-width: 126px;
    height: 30px;
    border-radius: 6px;
    border-color: ${PRIMARY_COLOR};
    color: ${PRIMARY_COLOR};
    background: #FFFFFF;
    box-shadow: none;
    font-weight: 500;
  }

  .chat-config-border-btn:hover,
  .chat-config-border-btn:focus {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.04) !important;
  }

  .chat-config-default-btn {
    min-width: 100px;
    height: 30px;
    border-radius: 6px;
    border-color: ${BORDER_COLOR};
    color: ${TEXT_SECONDARY};
    background: #FFFFFF;
    box-shadow: none;
    font-weight: 500;
  }

  .chat-config-default-btn:hover,
  .chat-config-default-btn:focus {
    border-color: #CBD0D6 !important;
    color: ${TEXT_SECONDARY} !important;
    background: #FAFBFC !important;
  }

  .chat-config-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    color: ${TEXT_MUTED};
    font-size: 12px;
    line-height: 1.25;
  }

  .chat-config-modal .ant-modal-content {
    border-radius: 14px;
    overflow: hidden;
  }

  .chat-config-panel .ant-form-item {
    margin-bottom: 0;
  }

  .chat-config-panel .ant-form-item-label {
    padding-bottom: 0;
  }

  .chat-config-panel .ant-form-item-explain {
    min-height: 0;
  }

  .chat-config-number-wrap .ant-input-number-input {
    padding-right: 34px !important;
  }

  .chat-config-modal__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .chat-config-modal__field {
    display: grid;
    gap: 6px;
  }

  .chat-config-modal__label {
    font-size: 14px;
    color: ${TEXT_MAIN};
    font-weight: 500;
  }

  .chat-config-modal__required {
    color: #F53F3F;
  }

  @media (max-width: 1280px) {
    .chat-config-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 900px) {
    .chat-config-page {
      height: auto;
    }

    .chat-config-form-grid,
    .chat-config-params,
    .chat-config-modal__grid {
      grid-template-columns: 1fr;
    }

    .chat-config-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .chat-config-item {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .chat-config-item__actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }

    .chat-config-testrow {
      grid-template-columns: 1fr;
    }
  }
`

export default function ChatConfigPage({
  form,
  loading,
  saving,
  testing,
  options,
  onOpenManual,
  onSave,
  onTest,
  result,
}: ChatConfigPageProps) {
  const [configForm] = Form.useForm<ChatModelFormValues>()
  const [createForm] = Form.useForm<CreateChatModelValues>()
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState(CHAT_MODELS[0].key)
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'm1', role: 'user', content: '请介绍一下景区最值得看的地方。' },
    {
      id: 'm2',
      role: 'assistant',
      content: '这里以山水风光和文化底蕴为特色，推荐先游览主景区，再体验特色步道与互动讲解服务。',
    },
    { id: 'm3', role: 'user', content: '景区适合带小朋友一起游玩吗？' },
  ])
  const [testInput, setTestInput] = useState('请输入测试问题，例如：请介绍一下景区的特色亮点')

  const watchedChatModel = Form.useWatch('chatModel', form)

  const allModels = useMemo(() => CHAT_MODELS, [])

  const selectedRecord = useMemo(() => {
    return allModels.find((item) => item.key === selectedKey) ?? allModels[0]
  }, [allModels, selectedKey])

  const currentOption = options.find((item) => item.value === selectedRecord?.modelCode)

  const providerOptions = useMemo(() => {
    const providers = Array.from(new Set(allModels.map((item) => item.provider)))
    return providers.map((provider) => ({ label: provider, value: provider }))
  }, [allModels])

  const filteredModels = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return allModels
    return allModels.filter((item) => {
      return (
        item.modelName.toLowerCase().includes(keyword)
        || item.modelCode.toLowerCase().includes(keyword)
        || item.provider.toLowerCase().includes(keyword)
        || item.purposeTags.some((tag) => tag.toLowerCase().includes(keyword))
      )
    })
  }, [allModels, searchText])

  const pagedModels = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredModels.slice(start, start + PAGE_SIZE)
  }, [filteredModels, page])

  useEffect(() => {
    if (!watchedChatModel && CHAT_MODELS[0]) {
      form.setFieldValue('chatModel', CHAT_MODELS[0].modelCode)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Ant Design form initialization must synchronize the selected card
      setSelectedKey(CHAT_MODELS[0].key)
      return
    }

    const model = allModels.find((item) => item.modelCode === watchedChatModel)
    if (model && model.key !== selectedKey) {
      setSelectedKey(model.key)
    }
  }, [allModels, form, selectedKey, watchedChatModel])

  useEffect(() => {
    if (!selectedRecord) return
    configForm.setFieldsValue({
      modelName: selectedRecord.modelName,
      modelCode: selectedRecord.modelCode,
      provider: selectedRecord.provider,
      contextLength: selectedRecord.contextLength,
      maxOutput: selectedRecord.maxOutput,
      endpoint: selectedRecord.endpoint,
      temperature: selectedRecord.temperature,
      topP: selectedRecord.topP,
      frequencyPenalty: selectedRecord.frequencyPenalty,
      presencePenalty: selectedRecord.presencePenalty,
    })
  }, [configForm, selectedRecord])

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

  const handleSelectModel = (record: ChatModelRecord) => {
    setSelectedKey(record.key)
    form.setFieldValue('chatModel', record.modelCode)
  }

  const handlePlayTest = (record: ChatModelRecord) => {
    handleSelectModel(record)
    onTest({ promptText: testInput.trim() })
  }

  const handleSendMessage = () => {
    const question = testInput.trim()
    if (!question) return

    onTest({ promptText: question })
  }

  const handleSave = async () => {
    await configForm.validateFields()
    onSave()
  }

  const handleReset = () => {
    if (!selectedRecord) return
    configForm.setFieldsValue({
      modelName: selectedRecord.modelName,
      modelCode: selectedRecord.modelCode,
      provider: selectedRecord.provider,
      contextLength: selectedRecord.contextLength,
      maxOutput: selectedRecord.maxOutput,
      endpoint: selectedRecord.endpoint,
      temperature: selectedRecord.temperature,
      topP: selectedRecord.topP,
      frequencyPenalty: selectedRecord.frequencyPenalty,
      presencePenalty: selectedRecord.presencePenalty,
    })
    setMessages([
      { id: 'm1', role: 'user', content: '请介绍一下景区最值得看的地方。' },
      {
        id: 'm2',
        role: 'assistant',
        content: '这里以山水风光和文化底蕴为特色，推荐先游览主景区，再体验特色步道与互动讲解服务。',
      },
      { id: 'm3', role: 'user', content: '景区适合带小朋友一起游玩吗？' },
    ])
    setTestInput('请输入测试问题，例如：请介绍一下景区的特色亮点')
  }

  const handleCreateModel = async () => {
    await createForm.validateFields()
    onOpenManual()
  }

  if (!selectedRecord) {
    return null
  }

  return (
    <div className="chat-config-page">
      <style>{CHAT_PAGE_STYLES}</style>

      <div className="chat-config-layout">
        <Card title="对话模型列表" className="chat-config-panel chat-config-list-card">
          <div className="chat-config-toolbar">
            <Input
              allowClear
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              prefix={<SearchOutlined style={{ color: TEXT_MUTED }} />}
              placeholder="搜索模型名称或标识"
            />
            <Button type="primary" icon={<PlusOutlined />} className="chat-config-primary-btn" onClick={onOpenManual}>
              手动维护
            </Button>
          </div>

          <div className="chat-config-list">
            {pagedModels.map((item) => {
              const active = item.key === selectedKey
              const theme = PROVIDER_THEME[item.providerTone]
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`chat-config-item ${active ? 'chat-config-item--active' : ''}`}
                  onClick={() => handleSelectModel(item)}
                >
                  <div className={`chat-config-avatar chat-config-avatar--${item.providerTone}`} style={{ background: `linear-gradient(180deg, ${theme.color}CC, ${theme.color})` }}>
                    {theme.icon}
                  </div>
                  <div className="chat-config-item__content">
                    <div className="chat-config-item__title-row">
                      <div className="chat-config-item__title">{item.modelName}</div>
                      {item.featuredLabel ? <span className="chat-config-item__badge">{item.featuredLabel}</span> : null}
                    </div>
                    <div className="chat-config-item__meta">
                      <span>提供方：{item.provider}</span>
                      <span>{item.contextLength.toLocaleString()} 上下文</span>
                    </div>
                    <div className="chat-config-item__purpose">
                      {item.purposeTags.map((tag) => (
                        <span key={tag} className="chat-config-purpose-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="chat-config-item__actions" onClick={(event) => event.stopPropagation()}>
                    <Button
                      type="text"
                      shape="circle"
                      className="chat-config-icon-btn"
                      icon={<PlayCircleOutlined />}
                      loading={testing && item.key === selectedKey}
                      onClick={() => handlePlayTest(item)}
                    />
                  </div>
                </button>
              )
            })}
          </div>

          <Pagination
            className="chat-config-pagination"
            current={page}
            pageSize={PAGE_SIZE}
            total={filteredModels.length}
            size="small"
            hideOnSinglePage={false}
            showSizeChanger={false}
            onChange={setPage}
          />
        </Card>

        <Card title="模型配置" className="chat-config-panel">
          <div className="chat-config-right-stack">
            <div>
              <div className="chat-config-section-title">基本信息</div>
              <Form form={configForm} layout="vertical" requiredMark={false} disabled={loading} className="chat-config-form-grid">
                <Form.Item
                  className="chat-config-field"
                  name="modelName"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                  label={<span className="chat-config-label">模型名称 <span className="chat-config-label__required">*</span></span>}
                >
                  <Input placeholder="请输入模型名称" />
                </Form.Item>
                <Form.Item
                  className="chat-config-field"
                  name="modelCode"
                  rules={[{ required: true, message: '请输入模型标识' }]}
                  label={<span className="chat-config-label">模型标识 <span className="chat-config-label__required">*</span></span>}
                >
                  <Input placeholder="请输入模型标识" />
                </Form.Item>
                <Form.Item
                  className="chat-config-field"
                  name="provider"
                  rules={[{ required: true, message: '请选择服务提供方' }]}
                  label={<span className="chat-config-label">服务提供方 <span className="chat-config-label__required">*</span></span>}
                >
                  <Select placeholder="请选择服务提供方" options={providerOptions} />
                </Form.Item>
                <Form.Item
                  className="chat-config-field"
                  name="contextLength"
                  rules={[{ required: true, message: '请输入上下文长度' }]}
                  label={<span className="chat-config-label">上下文长度 <span className="chat-config-label__required">*</span></span>}
                >
                  <div className="chat-config-number-wrap">
                    <InputNumber controls min={1} max={1000000} style={{ width: '100%' }} />
                    <span className="chat-config-number-unit">tokens</span>
                  </div>
                </Form.Item>
                <Form.Item
                  className="chat-config-field"
                  name="maxOutput"
                  rules={[{ required: true, message: '请输入最大输出' }]}
                  label={<span className="chat-config-label">最大输出 <span className="chat-config-label__required">*</span></span>}
                >
                  <div className="chat-config-number-wrap">
                    <InputNumber controls min={1} max={100000} style={{ width: '100%' }} />
                    <span className="chat-config-number-unit">tokens</span>
                  </div>
                </Form.Item>
                <Form.Item
                  className="chat-config-field chat-config-full"
                  name="endpoint"
                  rules={[{ required: true, message: '请输入接口地址' }]}
                  label={<span className="chat-config-label">接口地址 <span className="chat-config-label__required">*</span></span>}
                >
                  <Input placeholder="请输入接口地址" />
                </Form.Item>
              </Form>

              <div className="chat-config-status">
                <div className="chat-config-status__item">
                  <span className="chat-config-status__dot" />
                  <span>连接状态：</span>
                  <span className="chat-config-status__success">已连接</span>
                </div>
                <div className="chat-config-status__item">
                  <span>已应用场景：</span>
                  <span className="chat-config-status__tag">导游问答</span>
                  <span className="chat-config-status__tag">游客咨询</span>
                  <span className="chat-config-status__tag">后台助手</span>
                </div>
                <div className="chat-config-status__item">
                  <span>当前提供方：</span>
                  <span>{currentOption?.provider ?? selectedRecord.provider}</span>
                </div>
              </div>
            </div>

            <div>
              <div className="chat-config-section-title">参数设置</div>
              <div className="chat-config-params">
                {[
                  { label: 'Temperature', name: 'temperature', min: 0, max: 2, step: 0.1 },
                  { label: 'Top P', name: 'topP', min: 0, max: 1, step: 0.1 },
                  { label: 'Frequency Penalty', name: 'frequencyPenalty', min: -2, max: 2, step: 0.1 },
                  { label: 'Presence Penalty', name: 'presencePenalty', min: -2, max: 2, step: 0.1 },
                ].map((item) => (
                  <div key={item.name} className="chat-config-param">
                    <div className="chat-config-param__label">{item.label}</div>
                    <Form.Item className="chat-config-field" name={item.name} noStyle>
                      <InputNumber controls min={item.min} max={item.max} step={item.step} style={{ width: '100%' }} />
                    </Form.Item>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="chat-config-section-title">对话测试</div>
              <div className="chat-config-test">
                <div className="chat-config-testrow">
                  <Input
                    value={testInput}
                    onChange={(event) => setTestInput(event.target.value)}
                    placeholder="输入测试问题，例如：请介绍一下景区的特色亮点"
                  />
                  <Button type="primary" className="chat-config-send-btn" icon={<SendOutlined />} onClick={handleSendMessage} />
                </div>

                <div className="chat-config-scenes">
                  {CHAT_TEST_SCENES.map((item) => (
                    <Button key={item} className="chat-config-scene-btn" onClick={() => setTestInput(item)}>
                      {item}
                    </Button>
                  ))}
                </div>

                <div className="chat-config-history">
                  {messages.map((item) => (
                    <div key={item.id} className={`chat-config-message chat-config-message--${item.role}`}>
                      <div className={`chat-config-bubble chat-config-bubble--${item.role}`}>
                        <div className="chat-config-bubble__meta">
                          <span className={`chat-config-bubble__avatar chat-config-bubble__avatar--${item.role}`}>
                            {item.role === 'user' ? '用' : '助'}
                          </span>
                          <span>{item.role === 'user' ? '用户：' : '助手：'}</span>
                        </div>
                        <div>{item.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chat-config-actions">
              <Button type="primary" className="chat-config-save-btn" loading={saving} onClick={() => void handleSave()}>
                保存设置
              </Button>
              <Button className="chat-config-border-btn" loading={testing} onClick={() => onTest({ promptText: testInput.trim() })}>
                测试当前模型
              </Button>
              <Button className="chat-config-default-btn" onClick={handleReset}>
                重置表单
              </Button>
            </div>

            <div className="chat-config-note">
              <InfoCircleOutlined />
              <span>提示：对话模型用于文本对话、问答、景区介绍、路线推荐、智能辅助等场景</span>
            </div>

            {result ? <div style={{ display: 'none' }}>{result}</div> : null}
          </div>
        </Card>
      </div>

      <Modal
        open={addOpen}
        title="新增模型"
        destroyOnClose
        className="chat-config-modal"
        onCancel={() => setAddOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setAddOpen(false)}>
            取消
          </Button>,
          <Button key="confirm" type="primary" onClick={() => void handleCreateModel()}>
            确认新增
          </Button>,
        ]}
      >
        <Form
          form={createForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{
            modelName: 'deepseek-v4-pro',
            modelCode: 'deepseek-v4-pro',
            provider: 'DeepSeek',
            contextLength: 128000,
            maxOutput: 4096,
            endpoint: 'http://localhost:8000/v1/chat/completions',
          }}
          className="chat-config-modal__grid"
        >
          <Form.Item
            className="chat-config-modal__field"
            name="modelName"
            rules={[{ required: true, message: '请输入模型名称' }]}
            label={<span className="chat-config-modal__label">模型名称 <span className="chat-config-modal__required">*</span></span>}
          >
            <Input placeholder="请输入模型名称" />
          </Form.Item>
          <Form.Item
            className="chat-config-modal__field"
            name="modelCode"
            rules={[{ required: true, message: '请输入模型标识' }]}
            label={<span className="chat-config-modal__label">模型标识 <span className="chat-config-modal__required">*</span></span>}
          >
            <Input placeholder="请输入模型标识" />
          </Form.Item>
          <Form.Item
            className="chat-config-modal__field"
            name="provider"
            rules={[{ required: true, message: '请选择服务提供方' }]}
            label={<span className="chat-config-modal__label">服务提供方 <span className="chat-config-modal__required">*</span></span>}
          >
            <Select placeholder="请选择服务提供方" options={providerOptions} />
          </Form.Item>
          <Form.Item
            className="chat-config-modal__field"
            name="contextLength"
            rules={[{ required: true, message: '请输入上下文长度' }]}
            label={<span className="chat-config-modal__label">上下文长度 <span className="chat-config-modal__required">*</span></span>}
          >
            <InputNumber controls min={1} max={1000000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            className="chat-config-modal__field"
            name="maxOutput"
            rules={[{ required: true, message: '请输入最大输出' }]}
            label={<span className="chat-config-modal__label">最大输出 <span className="chat-config-modal__required">*</span></span>}
          >
            <InputNumber controls min={1} max={100000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            className="chat-config-modal__field chat-config-full"
            name="endpoint"
            rules={[{ required: true, message: '请输入接口地址' }]}
            label={<span className="chat-config-modal__label">接口地址 <span className="chat-config-modal__required">*</span></span>}
          >
            <Input placeholder="请输入接口地址" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
