import { useEffect, useMemo, useState } from 'react'
import {
  EllipsisOutlined,
  InfoCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Button, Card, Dropdown, Form, Input, Modal, Pagination, Select } from 'antd'
import type { FormInstance, MenuProps } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type SpeechTestForm = {
  speechTestText: string
}

type VoiceOption = {
  value: string
  label: string
}

type VoiceConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  speechTestForm: FormInstance<SpeechTestForm>
  loading: boolean
  saving: boolean
  testing: boolean
  options: VoiceOption[]
  onSave: () => void
  onTest: () => void
  onReset: () => void
  result: React.ReactNode
}

type VoiceAccent = 'blue' | 'cyan' | 'pink' | 'green'

interface VoiceCardRecord {
  key: string
  voiceName: string
  voiceId: string
  tags: string[]
  accent: VoiceAccent
  selectedLabel?: string
  provider: string
}

interface CreateVoiceFormValues {
  voiceName: string
  voiceId: string
  provider: string
  language: string
  gender: string
  style: string
}

const PRIMARY_COLOR = '#165DFF'
const ACCENT_COLORS: Record<VoiceAccent, string> = {
  blue: '#69B1FF',
  cyan: '#69D1D1',
  pink: '#F687B3',
  green: '#82D9A0',
}

const PAGE_SIZE = 5

const VOICE_MODEL_OPTIONS: VoiceOption[] = [
  { value: 'zh-CN-XiaoxiaoNeural', label: 'zh-CN-XiaoxiaoNeural' },
  { value: 'zh-CN-YunxiNeural', label: 'zh-CN-YunxiNeural' },
  { value: 'zh-CN-MeimeiNeural', label: 'zh-CN-MeimeiNeural' },
  { value: 'en-US-EmmaNeural', label: 'en-US-EmmaNeural' },
  { value: 'en-US-BrianNeural', label: 'en-US-BrianNeural' },
  { value: 'ja-JP-NanamiNeural', label: 'ja-JP-NanamiNeural' },
]

const VOICE_CATALOG: VoiceCardRecord[] = [
  {
    key: 'zh-cn-xiaoxiao',
    voiceName: '中文-小乔-通用',
    voiceId: 'zh-CN-XiaoxiaoNeural',
    tags: ['中文', '女声', '通用'],
    accent: 'blue',
    selectedLabel: '当前使用',
    provider: 'Edge-TTS',
  },
  {
    key: 'zh-cn-yunxi',
    voiceName: '中文-小云-成熟',
    voiceId: 'zh-CN-YunxiNeural',
    tags: ['中文', '男声', '成熟'],
    accent: 'cyan',
    provider: 'Edge-TTS',
  },
  {
    key: 'zh-cn-meimei',
    voiceName: '中文-小美-温柔',
    voiceId: 'zh-CN-MeimeiNeural',
    tags: ['中文', '女声', '温柔'],
    accent: 'pink',
    provider: 'Edge-TTS',
  },
  {
    key: 'en-us-emma',
    voiceName: '英文-Emma-通用',
    voiceId: 'en-US-EmmaNeural',
    tags: ['英文', '女声', '通用'],
    accent: 'green',
    provider: 'Edge-TTS',
  },
  {
    key: 'en-us-brian',
    voiceName: '英文-Brian-沉稳',
    voiceId: 'en-US-BrianNeural',
    tags: ['英文', '男声', '沉稳'],
    accent: 'cyan',
    provider: 'Edge-TTS',
  },
  {
    key: 'ja-jp-nanami',
    voiceName: '日语-Nanami-清澈',
    voiceId: 'ja-JP-NanamiNeural',
    tags: ['日语', '女声', '清澈'],
    accent: 'blue',
    provider: 'Edge-TTS',
  },
  {
    key: 'zh-cn-xiaoyi',
    voiceName: '中文-小艺-亲和',
    voiceId: 'zh-CN-XiaoyiNeural',
    tags: ['中文', '女声', '亲和'],
    accent: 'green',
    provider: 'Edge-TTS',
  },
  {
    key: 'zh-hk-hiugaai',
    voiceName: '粤语-HiuGaai-活泼',
    voiceId: 'zh-HK-HiuGaaiNeural',
    tags: ['粤语', '女声', '活泼'],
    accent: 'pink',
    provider: 'Edge-TTS',
  },
  {
    key: 'zh-tw-hsiaochen',
    voiceName: '繁中-HsiaoChen-温和',
    voiceId: 'zh-TW-HsiaoChenNeural',
    tags: ['繁中', '女声', '温和'],
    accent: 'blue',
    provider: 'Edge-TTS',
  },
  {
    key: 'ko-kr-sunhi',
    voiceName: '韩语-SunHi-清亮',
    voiceId: 'ko-KR-SunHiNeural',
    tags: ['韩语', '女声', '清亮'],
    accent: 'cyan',
    provider: 'Edge-TTS',
  },
  {
    key: 'en-us-guy',
    voiceName: '英文-Guy-沉稳',
    voiceId: 'en-US-GuyNeural',
    tags: ['英文', '男声', '沉稳'],
    accent: 'green',
    provider: 'Edge-TTS',
  },
  {
    key: 'ja-jp-shiori',
    voiceName: '日语-Shiori-柔和',
    voiceId: 'ja-JP-ShioriNeural',
    tags: ['日语', '女声', '柔和'],
    accent: 'pink',
    provider: 'Edge-TTS',
  },
]

const styles = `
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

  .voice-settings-page {
    display: grid;
    gap: 8px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .voice-settings-layout {
    display: grid;
    grid-template-columns: minmax(360px, 0.92fr) minmax(560px, 1.72fr);
    gap: 10px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }

  .voice-settings-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border: 1px solid #E5E6EB;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(17, 24, 39, 0.035);
    overflow: hidden;
  }

  .voice-settings-panel > .ant-card-head {
    min-height: 0;
    padding: 9px 12px 0;
    border-bottom: none;
  }

  .voice-settings-panel > .ant-card-head .ant-card-head-title {
    padding: 0;
    font-size: 14px;
    font-weight: 600;
    color: #1D2129;
  }

  .voice-settings-panel > .ant-card-body {
    display: grid;
    flex: 1;
    min-height: 0;
    gap: 8px;
    padding: 8px 12px 10px;
  }

  .voice-settings-list-card > .ant-card-body {
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
  }

  .voice-settings-form-card > .ant-card-body {
    grid-template-rows: auto auto auto auto auto minmax(0, auto);
    min-height: 0;
  }

  .voice-settings-toolbar {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .voice-settings-toolbar .ant-input-affix-wrapper {
    height: 30px;
    border-radius: 6px;
  }

  .voice-settings-toolbar .ant-input {
    font-size: 13px;
  }

  .voice-settings-primary-btn {
    height: 30px;
    padding: 0 12px;
    border-radius: 6px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
    font-weight: 500;
  }

  .voice-settings-primary-btn:hover,
  .voice-settings-primary-btn:focus {
    border-color: #0E42D2 !important;
    background: #0E42D2 !important;
  }

  .voice-settings-list {
    display: grid;
    gap: 5px;
    min-height: 0;
    align-content: start;
  }

  .voice-settings-item {
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

  .voice-settings-item:hover {
    border-color: rgba(22, 93, 255, 0.35);
    box-shadow: 0 8px 16px rgba(22, 93, 255, 0.08);
  }

  .voice-settings-item--active {
    border-color: ${PRIMARY_COLOR};
    background: linear-gradient(180deg, rgba(22, 93, 255, 0.05), rgba(22, 93, 255, 0.02));
    box-shadow: 0 8px 18px rgba(22, 93, 255, 0.10);
  }

  .voice-settings-icon {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #FFFFFF;
    box-shadow: inset 0 -12px 22px rgba(255, 255, 255, 0.18);
  }

  .voice-settings-wave {
    display: flex;
    align-items: end;
    gap: 2px;
    width: 18px;
    height: 18px;
  }

  .voice-settings-wave span {
    width: 2px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    animation: voiceWave 1.4s ease-in-out infinite;
  }

  .voice-settings-wave span:nth-child(1) { height: 8px; animation-delay: 0s; }
  .voice-settings-wave span:nth-child(2) { height: 16px; animation-delay: 0.12s; }
  .voice-settings-wave span:nth-child(3) { height: 11px; animation-delay: 0.24s; }
  .voice-settings-wave span:nth-child(4) { height: 18px; animation-delay: 0.36s; }
  .voice-settings-wave span:nth-child(5) { height: 10px; animation-delay: 0.48s; }

  .voice-settings-item__content {
    min-width: 0;
  }

  .voice-settings-item__title-row {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .voice-settings-item__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 600;
    color: #1D2129;
  }

  .voice-settings-item__badge {
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(22, 93, 255, 0.10);
    color: ${PRIMARY_COLOR};
    font-size: 12px;
    line-height: 16px;
    font-weight: 500;
  }

  .voice-settings-item__id,
  .voice-settings-item__tags {
    font-size: 12px;
    line-height: 1.2;
    color: #86909C;
  }

  .voice-settings-item__id {
    margin-top: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .voice-settings-item__tags {
    margin-top: 3px;
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }

  .voice-settings-tag {
    padding: 0 7px;
    border-radius: 999px;
    background: #F2F3F5;
    color: #4E5969;
    font-size: 12px;
    line-height: 16px;
  }

  .voice-settings-item__actions {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .voice-settings-icon-btn {
    width: 26px;
    height: 26px;
    border: 1px solid #E5E6EB;
    border-radius: 50%;
    background: #FFFFFF;
    color: ${PRIMARY_COLOR};
    box-shadow: none;
  }

  .voice-settings-icon-btn:hover,
  .voice-settings-icon-btn:focus {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.06) !important;
  }

  .voice-settings-pagination {
    display: flex;
    justify-content: center;
    padding-top: 0;
    min-height: 26px;
  }

  .voice-settings-pagination .ant-pagination-item,
  .voice-settings-pagination .ant-pagination-prev,
  .voice-settings-pagination .ant-pagination-next {
    min-width: 26px;
    height: 26px;
    line-height: 24px;
    border-radius: 6px;
  }

  .voice-settings-pagination .ant-pagination-item-active {
    border-color: ${PRIMARY_COLOR};
  }

  .voice-settings-form-section {
    display: grid;
    gap: 7px;
  }

  .voice-settings-section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #1D2129;
  }

  .voice-settings-section-title::before {
    content: '';
    width: 3px;
    height: 14px;
    border-radius: 999px;
    background: ${PRIMARY_COLOR};
  }

  .voice-settings-form-label {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
    font-size: 12px;
    font-weight: 500;
    color: #1D2129;
  }

  .voice-settings-form-label__required {
    color: #F53F3F;
  }

  .voice-settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px 14px;
  }

  .voice-settings-control .ant-input,
  .voice-settings-control .ant-input-affix-wrapper,
  .voice-settings-control .ant-select-selector {
    height: 30px !important;
    border-radius: 6px !important;
  }

  .voice-settings-control .ant-input-number {
    width: 100%;
    border-radius: 8px;
  }

  .voice-settings-help {
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.25;
    color: #86909C;
  }

  .voice-settings-preview {
    display: grid;
    gap: 6px;
  }

  .voice-settings-preview__box {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid #E5E6EB;
    background: linear-gradient(180deg, rgba(22, 93, 255, 0.06), rgba(22, 93, 255, 0.02));
  }

  .voice-settings-preview__play {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 0;
    background: rgba(22, 93, 255, 0.12);
    color: ${PRIMARY_COLOR};
    display: grid;
    place-items: center;
  }

  .voice-settings-preview__waves {
    display: flex;
    align-items: end;
    gap: 2px;
    height: 18px;
    min-width: 0;
    overflow: hidden;
  }

  .voice-settings-preview__waves span {
    width: 3px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(103, 176, 255, 0.95), rgba(22, 93, 255, 0.75));
    animation: voiceWave 1.2s ease-in-out infinite;
  }

  .voice-settings-preview__waves span:nth-child(1) { height: 8px; animation-delay: 0s; }
  .voice-settings-preview__waves span:nth-child(2) { height: 16px; animation-delay: 0.10s; }
  .voice-settings-preview__waves span:nth-child(3) { height: 12px; animation-delay: 0.20s; }
  .voice-settings-preview__waves span:nth-child(4) { height: 18px; animation-delay: 0.30s; }
  .voice-settings-preview__waves span:nth-child(5) { height: 10px; animation-delay: 0.40s; }
  .voice-settings-preview__waves span:nth-child(6) { height: 15px; animation-delay: 0.50s; }
  .voice-settings-preview__waves span:nth-child(7) { height: 9px; animation-delay: 0.60s; }
  .voice-settings-preview__waves span:nth-child(8) { height: 17px; animation-delay: 0.70s; }
  .voice-settings-preview__waves span:nth-child(9) { height: 11px; animation-delay: 0.80s; }
  .voice-settings-preview__waves span:nth-child(10) { height: 14px; animation-delay: 0.90s; }

  .voice-settings-preview__duration {
    color: #86909C;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .voice-settings-actions {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    padding-top: 2px;
  }

  .voice-settings-default-btn {
    height: 30px;
    padding: 0 12px;
    border-radius: 6px;
    border-color: #D0D3D9;
    color: #1D2129;
    background: #FFFFFF;
    box-shadow: none;
  }

  .voice-settings-default-btn:hover,
  .voice-settings-default-btn:focus {
    color: #1D2129 !important;
    border-color: #C9CDD4 !important;
    background: #F7F8FA !important;
  }

  .voice-settings-note {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 12px;
    line-height: 1.25;
    color: #86909C;
  }

  .voice-settings-extra-result {
    overflow: visible;
    padding-top: 0;
  }

  .voice-settings-extra-result .ant-card,
  .voice-settings-extra-result .admin-build-summary {
    margin: 0;
  }

  .voice-settings-extra-result .ant-card-body {
    padding: 6px 8px !important;
  }

  .voice-settings-extra-result .admin-test-result {
    gap: 3px;
  }

  .voice-settings-extra-result .admin-test-result__header,
  .voice-settings-extra-result .admin-test-result__meta {
    min-height: 0;
    line-height: 1.25;
  }

  .voice-settings-extra-result .admin-test-result__summary,
  .voice-settings-extra-result .admin-build-summary__time {
    line-height: 1.25;
  }

  .voice-settings-form-card .ant-form-item {
    margin-bottom: 0;
  }

  .voice-settings-form-card .ant-form-item-extra {
    min-height: 0;
    margin-top: 3px;
    font-size: 12px;
    line-height: 1.25;
  }

  .voice-settings-test-textarea {
    height: 66px !important;
    min-height: 66px !important;
    max-height: 66px !important;
    resize: none !important;
  }

  .voice-settings-empty {
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

  .voice-settings-modal .ant-modal-content {
    border-radius: 16px;
    padding: 20px 20px 12px;
  }

  @keyframes voiceWave {
    0%, 100% { transform: scaleY(0.75); opacity: 0.78; }
    50% { transform: scaleY(1.15); opacity: 1; }
  }

  @media (max-width: 1280px) {
    .voice-settings-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 900px) {
    .voice-settings-grid {
      grid-template-columns: 1fr;
    }

    .voice-settings-toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .voice-settings-item {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .voice-settings-item__actions {
      grid-column: 1 / -1;
      justify-content: flex-end;
    }

    .voice-settings-preview__box {
      grid-template-columns: auto minmax(0, 1fr);
    }

    .voice-settings-preview__duration {
      grid-column: 1 / -1;
      justify-self: end;
    }
  }
`

function buildVoiceIdMenu(
  onAction: (voiceId: string, action: 'copy' | 'setCurrent') => void,
  voiceId: string,
): MenuProps['items'] {
  return [
    {
      key: 'set-current',
      label: '设为当前使用',
      onClick: () => onAction(voiceId, 'setCurrent'),
    },
    {
      key: 'copy-id',
      label: '复制音色 ID',
      onClick: () => onAction(voiceId, 'copy'),
    },
  ]
}

export default function VoiceConfigPage({
  form,
  speechTestForm,
  loading,
  saving,
  testing,
  options,
  onSave,
  onTest,
  onReset,
  result,
}: VoiceConfigPageProps) {
  const selectedVoice = Form.useWatch('speechModel', form)

  const [searchKeyword, setSearchKeyword] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [customVoices, setCustomVoices] = useState<VoiceCardRecord[]>([])
  const [playingVoiceId, setPlayingVoiceId] = useState<string>('zh-CN-XiaoxiaoNeural')
  const [previewTime, setPreviewTime] = useState('00:00 / 00:08')
  const [createForm] = Form.useForm<CreateVoiceFormValues>()

  const mergedCatalog = useMemo(() => {
    return [...customVoices, ...VOICE_CATALOG]
  }, [customVoices])

  useEffect(() => {
    const matched = mergedCatalog.find((item) => item.voiceId === selectedVoice)
    if (matched) {
      setPlayingVoiceId(matched.voiceId)
      return
    }

    if (!selectedVoice) {
      form.setFieldValue('speechModel', VOICE_CATALOG[0].voiceId)
      setPlayingVoiceId(VOICE_CATALOG[0].voiceId)
    }
  }, [form, mergedCatalog, selectedVoice])

  const filteredCatalog = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    if (!keyword) {
      return mergedCatalog
    }

    return mergedCatalog.filter((item) => {
      const tagsText = item.tags.join(' ')
      return (
        item.voiceName.toLowerCase().includes(keyword)
        || item.voiceId.toLowerCase().includes(keyword)
        || tagsText.toLowerCase().includes(keyword)
      )
    })
  }, [mergedCatalog, searchKeyword])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword])

  const pagedCatalog = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredCatalog.slice(start, start + PAGE_SIZE)
  }, [currentPage, filteredCatalog])

  const currentVoice = useMemo(
    () => mergedCatalog.find((item) => item.voiceId === (selectedVoice || playingVoiceId)) ?? VOICE_CATALOG[0],
    [mergedCatalog, playingVoiceId, selectedVoice],
  )

  const voiceModelOptions = options.length
    ? options
    : VOICE_MODEL_OPTIONS

  const handleSelectVoice = (voice: VoiceCardRecord) => {
    form.setFieldValue('speechModel', voice.voiceId)
    setPlayingVoiceId(voice.voiceId)
    setPreviewTime('00:00 / 00:08')
  }

  const handlePlayVoice = (voiceId: string) => {
    setPlayingVoiceId(voiceId)
    setPreviewTime('00:00 / 00:08')
    window.setTimeout(() => {
      if (playingVoiceId === voiceId) {
        setPreviewTime('00:08 / 00:08')
      }
    }, 900)
  }

  const handleCreateVoice = async () => {
    const values = await createForm.validateFields()
    const nextVoice: VoiceCardRecord = {
      key: `custom-${values.voiceId}`,
      voiceName: values.voiceName,
      voiceId: values.voiceId,
      tags: [values.language, values.gender, values.style].filter(Boolean),
      accent: 'blue',
      provider: values.provider,
    }

    setCustomVoices((current) => [nextVoice, ...current])
    handleSelectVoice(nextVoice)
    createForm.resetFields()
    setCreateModalOpen(false)
  }

  const handleVoiceMenuAction = (voiceId: string, action: 'copy' | 'setCurrent') => {
    if (action === 'setCurrent') {
      const current = mergedCatalog.find((item) => item.voiceId === voiceId)
      if (current) {
        handleSelectVoice(current)
      }
      return
    }

    void navigator.clipboard?.writeText?.(voiceId)
  }

  if (!currentVoice) {
    return (
      <div className="voice-settings-page">
        <style>{styles}</style>
        <div className="voice-settings-empty">???????????</div>
      </div>
    )
  }

  return (
    <div className="voice-settings-page">
      <style>{styles}</style>
      <div className="voice-settings-layout">
        <Card title="语音音色列表" className="voice-settings-panel voice-settings-list-card">
          <div className="voice-settings-toolbar">
            <Input
              allowClear
              placeholder="搜索音色名称"
              prefix={<SearchOutlined style={{ color: '#86909C' }} />}
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="voice-settings-primary-btn"
              onClick={() => setCreateModalOpen(true)}
            >
              新增音色
            </Button>
          </div>

          <div className="voice-settings-list">
            {pagedCatalog.map((item) => {
              const selected = item.voiceId === selectedVoice
              const accent = ACCENT_COLORS[item.accent]

              return (
                <div
                  key={item.key}
                  className={`voice-settings-item ${selected ? 'voice-settings-item--active' : ''}`}
                  onClick={() => handleSelectVoice(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleSelectVoice(item)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="voice-settings-icon" style={{ background: `linear-gradient(180deg, ${accent}, ${PRIMARY_COLOR})` }}>
                    <div className="voice-settings-wave" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>

                  <div className="voice-settings-item__content">
                    <div className="voice-settings-item__title-row">
                      <span className="voice-settings-item__title">{item.voiceName}</span>
                      {item.selectedLabel ? <span className="voice-settings-item__badge">{item.selectedLabel}</span> : null}
                    </div>
                    <div className="voice-settings-item__id">{item.voiceId}</div>
                    <div className="voice-settings-item__tags">
                      {item.tags.map((tag) => (
                        <span key={`${item.key}-${tag}`} className="voice-settings-tag">{tag}</span>
                      ))}
                    </div>
                  </div>

                  <div className="voice-settings-item__actions">
                    <Button
                      type="text"
                      className="voice-settings-icon-btn"
                      icon={playingVoiceId === item.voiceId ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                      onClick={(event) => {
                        event.stopPropagation()
                        handlePlayVoice(item.voiceId)
                      }}
                    />
                    <Dropdown menu={{ items: buildVoiceIdMenu(handleVoiceMenuAction, item.voiceId) }} trigger={['click']}>
                      <Button
                        type="text"
                        className="voice-settings-icon-btn"
                        icon={<EllipsisOutlined />}
                        onClick={(event) => event.stopPropagation()}
                      />
                    </Dropdown>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="voice-settings-pagination">
            <Pagination
              current={currentPage}
              pageSize={PAGE_SIZE}
              total={filteredCatalog.length}
              size="small"
              showSizeChanger={false}
              onChange={setCurrentPage}
            />
          </div>
        </Card>

        <Card title="音色配置" className="voice-settings-panel voice-settings-form-card">
          <div className="voice-settings-form-section">
            <div className="voice-settings-section-title">基本信息</div>

            <div className="voice-settings-grid">
              <div className="voice-settings-control">
                <div className="voice-settings-form-label">
                  <span>音色名称</span>
                  <span className="voice-settings-form-label__required">*</span>
                  <span style={{ marginLeft: 'auto', color: '#86909C', fontSize: 12 }}>10/50</span>
                </div>
                <Input
                  value={currentVoice.voiceName}
                  maxLength={50}
                  showCount
                  disabled
                />
              </div>

              <div className="voice-settings-control">
                <div className="voice-settings-form-label">
                  <span>语音模型</span>
                  <span className="voice-settings-form-label__required">*</span>
                </div>
                <Select
                  value={selectedVoice}
                  options={voiceModelOptions}
                  onChange={(value) => {
                    const next = mergedCatalog.find((item) => item.voiceId === value)
                    if (next) {
                      handleSelectVoice(next)
                    } else {
                      form.setFieldValue('speechModel', value)
                    }
                  }}
                  disabled={loading}
                />
                <div className="voice-settings-help">
                  当前选择的模型基�?edge-tts 能力，会直接展示本机环境真实支持的微�?voice 列表
                </div>
              </div>
            </div>
          </div>

          <div className="voice-settings-form-section">
            <div className="voice-settings-section-title">试听音色</div>

            <div className="voice-settings-preview">
              <div className="voice-settings-preview__box">
                <button
                  type="button"
                  className="voice-settings-preview__play"
                  onClick={() => handlePlayVoice(currentVoice.voiceId)}
                >
                  {playingVoiceId === currentVoice.voiceId ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                </button>
                <div className="voice-settings-preview__waves" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="voice-settings-preview__duration">{previewTime}</div>
              </div>
            </div>
          </div>

          <div className="voice-settings-actions">
            <Button
              type="primary"
              className="voice-settings-primary-btn"
              loading={saving}
              onClick={() => {
                form.setFieldValue('speechModel', currentVoice.voiceId)
                onSave()
              }}
            >
              保存设置
            </Button>
            <Button
              className="voice-settings-default-btn"
              loading={testing}
              onClick={() => {
                form.setFieldValue('speechModel', currentVoice.voiceId)
                onTest()
              }}
            >
              测试当前音色
            </Button>
            <Button className="voice-settings-default-btn" onClick={onReset}>
              重置表单
            </Button>
          </div>

          <div className="voice-settings-form-section">
            <div className="voice-settings-section-title">测试文本</div>
            <Form form={speechTestForm} layout="vertical">
              <Form.Item
                name="speechTestText"
                rules={[{ required: true, message: '请输入测试文本' }]}
                extra="点击“测试当前音色”时，会用这里的内容做一次本地语音合成测试"
              >
                <Input.TextArea
                  rows={3}
                  className="voice-settings-test-textarea"
                  maxLength={200}
                  showCount
                  placeholder="请输入想试听的文字内容"
                  disabled={loading}
                />
              </Form.Item>
            </Form>
          </div>

          <div className="voice-settings-note">
            <InfoCircleOutlined />
            <span>点击“测试当前音色”时，会用这里的内容做一次本地语音合成测试。</span>
          </div>

          {result ? <div className="voice-settings-extra-result">{result}</div> : null}
        </Card>
      </div>

      <Modal
        title="新增音色"
        open={isCreateModalOpen}
        onCancel={() => {
          setCreateModalOpen(false)
          createForm.resetFields()
        }}
        onOk={() => void handleCreateVoice()}
        okText="确认新增"
        cancelText="取消"
        className="voice-settings-modal"
      >
        <Form form={createForm} layout="vertical" initialValues={{ provider: 'Edge-TTS', language: '??', gender: '??', style: '??' }}>
          <Form.Item label="????" name="voiceName" rules={[{ required: true, message: '???????' }]}>
            <Input placeholder="?????-??-??" />
          </Form.Item>
          <Form.Item label="????" name="voiceId" rules={[{ required: true, message: '???????' }]}>
            <Select options={voiceModelOptions} showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="?????" name="provider" rules={[{ required: true, message: '????????' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="??" name="language" rules={[{ required: true, message: '?????' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="??" name="gender" rules={[{ required: true, message: '?????' }]}>
            <Input />
          </Form.Item>
          <Form.Item label="??" name="style" rules={[{ required: true, message: '?????' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
