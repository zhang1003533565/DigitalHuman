import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  EllipsisOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SoundOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Button, Card, Dropdown, Form, Input, Modal, Pagination, Select, Tag, Upload, message } from 'antd'
import type { FormInstance, MenuProps, UploadProps } from 'antd'

type AdminModelSettings = {
  embeddingModel: string
  speechModel: string
  visionModel: string
  chatModel: string
  multimodalModel: string
}

type VisionOption = {
  value: string
  provider?: string
}

type VisionConfigPageProps = {
  form: FormInstance<AdminModelSettings>
  loading: boolean
  saving: boolean
  testing: boolean
  options: VisionOption[]
  onOpenManual: () => void
  onSave: () => void
  onTest: (payload?: { promptText?: string; imageDataUrl?: string; mode?: string }) => void
  result: ReactNode
  testResult?: {
    success: boolean
    message: string
    detail?: string
  } | null
}

type VisionTone = 'purple' | 'green' | 'violet' | 'orange' | 'red'

interface VisionModelRecord {
  key: string
  modelName: string
  modelCode: string
  provider: string
  accent: VisionTone
  capabilities: string[]
  linkedScenes: number
  endpoint: string
  resolution: string
  maxDuration: string
  frameRate: string
  taskId: string
  generatedAt: string
  outputResolution: string
  outputDuration: string
  outputFrameRate: string
  outputFormat: string
  previewCover: string
  featuredLabel?: string
}

interface VisionDetailFormValues {
  modelName: string
  modelCode: string
  provider: string
  endpoint: string
  resolution: string
  maxDuration: string
  frameRate: string
  promptText: string
  negativePromptText?: string
  duration: string
  ratio: string
  style: string
  cameraMotion: string
}

interface CreateModelFormValues {
  modelName: string
  modelCode: string
  provider: string
  endpoint: string
}

const PRIMARY_COLOR = '#165DFF'
const SUCCESS_COLOR = '#00B42A'
const CARD_BORDER = '#E5E6EB'
const TEXT_MAIN = '#1D2129'
const TEXT_SECONDARY = '#4E5969'
const TEXT_MUTED = '#86909C'

const PAGE_SIZE = 5

function buildPreviewCover(accent: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#CBE8FF"/>
          <stop offset="60%" stop-color="#8ED0FF"/>
          <stop offset="100%" stop-color="#1D4E89"/>
        </linearGradient>
      </defs>
      <rect width="960" height="540" fill="url(#sky)"/>
      <path d="M0 346 C120 316, 220 286, 310 294 C398 302, 472 338, 560 298 C660 252, 742 164, 838 202 C905 230, 940 274, 960 258 L960 540 L0 540 Z" fill="#29598B" opacity="0.9"/>
      <path d="M0 382 C116 360, 222 326, 316 340 C402 352, 482 394, 572 370 C650 350, 724 290, 820 310 C892 326, 934 358, 960 354 L960 540 L0 540 Z" fill="#163B5E" opacity="0.95"/>
      <path d="M0 396 C118 392, 250 380, 348 390 C450 402, 524 438, 614 424 C702 410, 780 366, 878 376 C928 380, 952 390, 960 396 L960 540 L0 540 Z" fill="#3EC1B8"/>
      <circle cx="820" cy="368" r="52" fill="#FFFFFF" opacity="0.15"/>
      <path d="M802 342 L802 394 L848 368 Z" fill="#FFFFFF" opacity="0.9"/>
      <rect x="36" y="34" width="126" height="38" rx="19" fill="${accent}" opacity="0.95"/>
      <text x="99" y="60" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#FFFFFF">VISION</text>
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const DURATION_OPTIONS = ['5s', '10s', '15s'] as const
const RATIO_OPTIONS = ['16:9', '9:16'] as const
const STYLE_OPTIONS = ['写实', '电影', '动漫', '国风', '水墨'] as const
const CAMERA_OPTIONS = ['静止', '平移', '推进', '拉远', '环绕'] as const

const VISION_MODEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'Runway', label: 'Runway' },
  { value: '快手可灵', label: '快手可灵' },
  { value: '阿里通义', label: '阿里通义' },
  { value: 'Pika Labs', label: 'Pika Labs' },
  { value: 'MiniMax', label: 'MiniMax' },
  { value: 'Luma AI', label: 'Luma AI' },
  { value: '生数科技', label: '生数科技' },
  { value: 'PixVerse', label: 'PixVerse' },
  { value: '腾讯混元', label: '腾讯混元' },
  { value: 'Stability AI', label: 'Stability AI' },
]

const VISION_RESOLUTION_OPTIONS = [
  { value: '1280 × 720（720p）', label: '1280 × 720（720p）' },
  { value: '1024 × 576（576p）', label: '1024 × 576（576p）' },
  { value: '960 × 540（540p）', label: '960 × 540（540p）' },
]

const VISION_DURATION_OPTIONS = [
  { value: '8 秒', label: '8 秒' },
  { value: '10 秒', label: '10 秒' },
  { value: '12 秒', label: '12 秒' },
  { value: '15 秒', label: '15 秒' },
]

const VISION_FPS_OPTIONS = [
  { value: '24 fps', label: '24 fps' },
  { value: '30 fps', label: '30 fps' },
]

const VISION_MODELS: VisionModelRecord[] = [
  {
    key: 'runway-gen4',
    modelName: 'Runway Gen-4',
    modelCode: 'runway-gen4',
    provider: 'Runway',
    accent: 'violet',
    capabilities: ['文生视频', '图生视频', '角色动画', '运镜控制'],
    linkedScenes: 28,
    endpoint: 'https://api.runwayml.com/v1/video/generate',
    resolution: '1280 × 720（720p）',
    maxDuration: '15 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0001',
    generatedAt: '2025-05-20 14:32:18',
    outputResolution: '1280 × 720（720p）',
    outputDuration: '10 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#7B61FF'),
    featuredLabel: '当前使用',
  },
  {
    key: 'kling-16',
    modelName: 'Kling 1.6',
    modelCode: 'kling-16',
    provider: '快手可灵',
    accent: 'green',
    capabilities: ['文生视频', '图生视频', '角色动画'],
    linkedScenes: 19,
    endpoint: 'https://api.klingai.com/v1/video/generate',
    resolution: '1280 × 720（720p）',
    maxDuration: '10 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0002',
    generatedAt: '2025-05-20 14:36:02',
    outputResolution: '1280 × 720（720p）',
    outputDuration: '10 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#36B37E'),
  },
  {
    key: 'wan21-video',
    modelName: 'Wan2.1 Video',
    modelCode: 'wan21-video',
    provider: '阿里通义',
    accent: 'violet',
    capabilities: ['文生视频', '图生视频', '运镜控制'],
    linkedScenes: 16,
    endpoint: 'https://dashscope.aliyuncs.com/api/v1/video-generation',
    resolution: '1024 × 576（576p）',
    maxDuration: '8 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0003',
    generatedAt: '2025-05-20 15:02:41',
    outputResolution: '1024 × 576（576p）',
    outputDuration: '8 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#722ED1'),
  },
  {
    key: 'pika-22',
    modelName: 'Pika 2.2',
    modelCode: 'pika-22',
    provider: 'Pika Labs',
    accent: 'orange',
    capabilities: ['文生视频', '图生视频', '风格迁移'],
    linkedScenes: 11,
    endpoint: 'https://api.pika.art/v1/video/generate',
    resolution: '1024 × 576（576p）',
    maxDuration: '15 秒',
    frameRate: '30 fps',
    taskId: 'task_20250520_0004',
    generatedAt: '2025-05-20 15:18:09',
    outputResolution: '1024 × 576（576p）',
    outputDuration: '15 秒',
    outputFrameRate: '30 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#FF9500'),
  },
  {
    key: 'hailuo-video',
    modelName: 'Hailuo Video',
    modelCode: 'hailuo-video',
    provider: 'MiniMax',
    accent: 'red',
    capabilities: ['文生视频', '图生视频', '角色动画', '运镜控制'],
    linkedScenes: 24,
    endpoint: 'https://api.minimax.chat/v1/video/generate',
    resolution: '1280 × 720（720p）',
    maxDuration: '10 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0005',
    generatedAt: '2025-05-20 15:38:44',
    outputResolution: '1280 × 720（720p）',
    outputDuration: '10 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#FF5C33'),
  },
  {
    key: 'luma-dream',
    modelName: 'Luma Dream Machine',
    modelCode: 'luma-dream',
    provider: 'Luma AI',
    accent: 'violet',
    capabilities: ['文生视频', '图生视频'],
    linkedScenes: 9,
    endpoint: 'https://api.luma.ai/v1/video/generations',
    resolution: '1024 × 576（576p）',
    maxDuration: '10 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0006',
    generatedAt: '2025-05-20 16:02:11',
    outputResolution: '1024 × 576（576p）',
    outputDuration: '10 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#9B7BFF'),
  },
  {
    key: 'vidu-q1',
    modelName: 'Vidu Q1',
    modelCode: 'vidu-q1',
    provider: '生数科技',
    accent: 'green',
    capabilities: ['文生视频', '角色动画'],
    linkedScenes: 7,
    endpoint: 'https://api.vidu.com/v1/video/generate',
    resolution: '960 × 540（540p）',
    maxDuration: '8 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0007',
    generatedAt: '2025-05-20 16:20:53',
    outputResolution: '960 × 540（540p）',
    outputDuration: '8 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#2ABF88'),
  },
  {
    key: 'pixverse-v4',
    modelName: 'PixVerse V4',
    modelCode: 'pixverse-v4',
    provider: 'PixVerse',
    accent: 'orange',
    capabilities: ['文生视频', '图生视频', '运镜控制'],
    linkedScenes: 14,
    endpoint: 'https://api.pixverse.ai/v1/video/generate',
    resolution: '1280 × 720（720p）',
    maxDuration: '12 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0008',
    generatedAt: '2025-05-20 16:33:22',
    outputResolution: '1280 × 720（720p）',
    outputDuration: '12 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#FFAE42'),
  },
  {
    key: 'tencent-hunyuan',
    modelName: 'Hunyuan Video',
    modelCode: 'tencent-hunyuan',
    provider: '腾讯混元',
    accent: 'violet',
    capabilities: ['文生视频', '图生视频', '角色动画'],
    linkedScenes: 21,
    endpoint: 'https://hunyuan.tencent.com/v1/video/generate',
    resolution: '1280 × 720（720p）',
    maxDuration: '15 秒',
    frameRate: '24 fps',
    taskId: 'task_20250520_0009',
    generatedAt: '2025-05-20 16:51:17',
    outputResolution: '1280 × 720（720p）',
    outputDuration: '15 秒',
    outputFrameRate: '24 fps',
    outputFormat: 'MP4',
    previewCover: buildPreviewCover('#8758FF'),
  },
]

const VISION_PAGE_STYLES = `
  .vision-settings-page {
    display: grid;
    gap: 16px;
    min-height: 0;
  }

  .vision-settings-layout {
    display: grid;
    grid-template-columns: minmax(360px, 1.02fr) minmax(640px, 1.98fr);
    gap: 16px;
    min-height: 0;
  }

  .vision-settings-panel {
    border: 1px solid ${CARD_BORDER};
    border-radius: 14px;
    box-shadow: 0 8px 20px rgba(17, 24, 39, 0.05);
    overflow: hidden;
    background: #FFFFFF;
  }

  .vision-settings-panel > .ant-card-head {
    min-height: 0;
    padding: 14px 16px 0;
    border-bottom: none;
  }

  .vision-settings-panel > .ant-card-head .ant-card-head-title {
    padding: 0;
    font-size: 15px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .vision-settings-panel > .ant-card-body {
    display: grid;
    gap: 12px;
    padding: 12px 14px 14px;
  }

  .vision-settings-list-card > .ant-card-body {
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
    height: 100%;
  }

  .vision-settings-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .vision-settings-toolbar .ant-input-affix-wrapper {
    height: 34px;
    border-radius: 8px;
  }

  .vision-settings-primary-btn {
    height: 34px;
    padding: 0 16px;
    border-radius: 8px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
    font-weight: 500;
  }

  .vision-settings-primary-btn:hover,
  .vision-settings-primary-btn:focus {
    border-color: #0E42D2 !important;
    background: #0E42D2 !important;
  }

  .vision-settings-list {
    display: grid;
    gap: 12px;
    min-height: 0;
    align-content: start;
  }

  .vision-settings-item {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    padding: 12px 12px 12px 10px;
    border: 1px solid ${CARD_BORDER};
    border-radius: 12px;
    background: #FFFFFF;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .vision-settings-item:hover {
    border-color: rgba(22, 93, 255, 0.35);
    box-shadow: 0 8px 16px rgba(22, 93, 255, 0.08);
  }

  .vision-settings-item--active {
    border-color: ${PRIMARY_COLOR};
    background: linear-gradient(180deg, rgba(22, 93, 255, 0.05), rgba(22, 93, 255, 0.02));
    box-shadow: 0 8px 18px rgba(22, 93, 255, 0.10);
  }

  .vision-settings-icon {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: #FFFFFF;
    box-shadow: inset 0 -12px 22px rgba(255, 255, 255, 0.16);
    font-size: 18px;
    font-weight: 700;
  }

  .vision-settings-icon--purple { background: linear-gradient(180deg, #8E74FF, #6F51FF); }
  .vision-settings-icon--green { background: linear-gradient(180deg, #4BC79A, #2A9F7B); }
  .vision-settings-icon--violet { background: linear-gradient(180deg, #A46BFF, #6A35FF); }
  .vision-settings-icon--orange { background: linear-gradient(180deg, #FFB44D, #FF9500); }
  .vision-settings-icon--red { background: linear-gradient(180deg, #FF7B5A, #FF5C33); }

  .vision-settings-item__content { min-width: 0; }

  .vision-settings-item__title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .vision-settings-item__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    color: ${TEXT_MAIN};
  }

  .vision-settings-item__badge {
    flex: none;
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(22, 93, 255, 0.10);
    color: ${PRIMARY_COLOR};
    font-size: 12px;
    line-height: 20px;
    font-weight: 500;
  }

  .vision-settings-item__provider,
  .vision-settings-item__meta {
    font-size: 11px;
    line-height: 1.5;
    color: ${TEXT_MUTED};
  }

  .vision-settings-item__provider { margin-top: 4px; }

  .vision-settings-item__meta {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vision-settings-tag {
    padding: 0 8px;
    border-radius: 2px;
    background: #F2F3F5;
    color: ${TEXT_SECONDARY};
    font-size: 11px;
    line-height: 18px;
  }

  .vision-settings-item__actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vision-settings-icon-btn {
    width: 30px;
    height: 30px;
    border: 1px solid ${CARD_BORDER};
    border-radius: 50%;
    background: #FFFFFF;
    color: ${PRIMARY_COLOR};
    box-shadow: none;
  }

  .vision-settings-pagination {
    display: flex;
    justify-content: center;
    padding-top: 4px;
  }

  .vision-settings-pagination .ant-pagination-item,
  .vision-settings-pagination .ant-pagination-prev,
  .vision-settings-pagination .ant-pagination-next {
    min-width: 30px;
    height: 30px;
    line-height: 28px;
    border-radius: 8px;
  }

  .vision-settings-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
  }

  .vision-settings-control .ant-input,
  .vision-settings-control .ant-input-affix-wrapper,
  .vision-settings-control .ant-select-selector,
  .vision-settings-control .ant-input-number {
    min-height: 36px !important;
    border-radius: 8px !important;
  }

  .vision-settings-form-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    font-size: 13px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .vision-settings-form-label__required { color: #F53F3F; }

  .vision-settings-section-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .vision-settings-section-title::before {
    content: '';
    width: 3px;
    height: 16px;
    border-radius: 999px;
    background: ${PRIMARY_COLOR};
  }

  .vision-settings-status {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid ${CARD_BORDER};
    border-radius: 8px;
    background: #FFFFFF;
    color: ${TEXT_SECONDARY};
    font-size: 12px;
    flex-wrap: wrap;
  }

  .vision-settings-status__item {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .vision-settings-status__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${SUCCESS_COLOR};
    box-shadow: 0 0 0 4px rgba(0, 180, 42, 0.12);
  }

  .vision-settings-status__success { color: ${SUCCESS_COLOR}; font-weight: 600; }
  .vision-settings-status__link { color: ${PRIMARY_COLOR}; font-weight: 600; }

  .vision-settings-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .vision-settings-chip {
    padding: 0 8px;
    line-height: 20px;
    border-radius: 2px;
    background: rgba(22, 93, 255, 0.08);
    color: ${PRIMARY_COLOR};
    font-size: 11px;
    font-weight: 500;
  }

  .vision-settings-right-stack {
    display: grid;
    gap: 12px;
  }

  .vision-settings-split {
    display: grid;
    grid-template-columns: minmax(0, 1.12fr) minmax(320px, 0.88fr);
    gap: 10px;
    align-items: start;
  }

  .vision-settings-split__left,
  .vision-settings-split__right {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .vision-settings-upload {
    padding: 12px !important;
    border: 1px dashed #C9CDD4 !important;
    border-radius: 10px !important;
    background: #FBFCFE !important;
  }

  .vision-settings-upload__title {
    margin-top: 6px;
    font-size: 13px;
    color: ${TEXT_SECONDARY};
  }

  .vision-settings-upload__desc {
    margin-top: 4px;
    font-size: 11px;
    color: ${TEXT_MUTED};
  }

  .vision-settings-upload__preview {
    position: relative;
    overflow: hidden;
    border-radius: 10px;
    border: 1px solid ${CARD_BORDER};
    background: #FBFCFE;
  }

  .vision-settings-upload__preview img {
    display: block;
    width: 100%;
    height: 170px;
    object-fit: cover;
  }

  .vision-settings-upload__remove {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.52);
    color: #FFFFFF;
    cursor: pointer;
  }

  .vision-settings-preview-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .vision-settings-preview-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .vision-settings-preview-title::before {
    content: '';
    width: 3px;
    height: 16px;
    border-radius: 999px;
    background: ${PRIMARY_COLOR};
  }

  .vision-settings-preview-card,
  .vision-settings-info-card {
    border: 1px solid ${CARD_BORDER};
    border-radius: 10px;
    background: #FFFFFF;
    overflow: hidden;
  }

  .vision-settings-preview-card {
    position: relative;
  }

  .vision-settings-preview-card__toolbar {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
  }

  .vision-settings-preview-card__inner {
    position: relative;
    overflow: hidden;
    min-height: 230px;
    background: linear-gradient(180deg, #C9ECFF 0%, #77B8F3 38%, #1D4E89 100%);
  }

  .vision-settings-preview-card__inner img {
    display: block;
    width: 100%;
    height: 230px;
    object-fit: cover;
  }

  .vision-settings-preview-card__overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.02), rgba(0, 0, 0, 0.10));
  }

  .vision-settings-preview-play {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.82);
    color: #FFFFFF;
    background: rgba(255, 255, 255, 0.12);
    display: grid;
    place-items: center;
    backdrop-filter: blur(10px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18);
    font-size: 18px;
  }

  .vision-settings-player-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto auto;
    gap: 10px;
    align-items: center;
    padding: 8px 10px;
    color: #FFFFFF;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0.68));
  }

  .vision-settings-player-button {
    width: 22px;
    height: 22px;
    border: 0;
    background: transparent;
    color: #FFFFFF;
    cursor: pointer;
    padding: 0;
  }

  .vision-settings-player-time {
    font-size: 11px;
    white-space: nowrap;
  }

  .vision-settings-player-track {
    height: 4px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.22);
    overflow: hidden;
  }

  .vision-settings-player-track__progress {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #86B8FF, #FFFFFF);
  }

  .vision-settings-player-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .vision-settings-info-grid {
    display: grid;
    gap: 8px;
    padding: 10px;
  }

  .vision-settings-info-title {
    font-size: 13px;
    font-weight: 500;
    color: ${TEXT_MAIN};
  }

  .vision-settings-info-item {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: ${TEXT_SECONDARY};
    line-height: 1.5;
  }

  .vision-settings-info-item span:last-child {
    color: ${TEXT_MAIN};
    font-weight: 500;
    text-align: right;
  }

  .vision-settings-mode-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .vision-settings-mode-btn {
    height: 30px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid ${CARD_BORDER};
    color: ${TEXT_SECONDARY};
    background: #FFFFFF;
    box-shadow: none;
  }

  .vision-settings-mode-btn:hover {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.04) !important;
  }

  .vision-settings-mode-btn--active {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.08) !important;
  }

  .vision-settings-action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .vision-settings-save-btn {
    min-width: 132px;
    height: 36px;
    border-radius: 8px;
    border-color: ${PRIMARY_COLOR};
    background: ${PRIMARY_COLOR};
    box-shadow: none;
    font-weight: 500;
  }

  .vision-settings-save-btn:hover,
  .vision-settings-save-btn:focus {
    border-color: #0E42D2 !important;
    background: #0E42D2 !important;
  }

  .vision-settings-border-btn {
    min-width: 148px;
    height: 36px;
    border-radius: 8px;
    border-color: ${PRIMARY_COLOR};
    color: ${PRIMARY_COLOR};
    background: #FFFFFF;
    box-shadow: none;
    font-weight: 500;
  }

  .vision-settings-border-btn:hover,
  .vision-settings-border-btn:focus {
    border-color: ${PRIMARY_COLOR} !important;
    color: ${PRIMARY_COLOR} !important;
    background: rgba(22, 93, 255, 0.04) !important;
  }

  .vision-settings-default-btn {
    min-width: 118px;
    height: 36px;
    border-radius: 8px;
    border-color: ${CARD_BORDER};
    color: ${TEXT_SECONDARY};
    background: #FFFFFF;
    box-shadow: none;
    font-weight: 500;
  }

  .vision-settings-default-btn:hover,
  .vision-settings-default-btn:focus {
    border-color: #CBD0D6 !important;
    color: ${TEXT_SECONDARY} !important;
    background: #FAFBFC !important;
  }

  .vision-settings-footer-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11px;
    line-height: 1.6;
    color: ${TEXT_MUTED};
  }

  .vision-settings-modal .ant-modal-content {
    border-radius: 14px;
    overflow: hidden;
  }

  .vision-settings-modal__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .vision-settings-modal__field {
    display: grid;
    gap: 6px;
  }

  .vision-settings-modal__label {
    font-size: 14px;
    color: ${TEXT_MAIN};
    font-weight: 500;
  }

  .vision-settings-modal__required {
    color: #F53F3F;
  }

  @media (max-width: 1280px) {
    .vision-settings-layout {
      grid-template-columns: 1fr;
    }

    .vision-settings-split {
      grid-template-columns: 1fr;
    }
  }
`

const ICON_CLASS_MAP: Record<VisionTone, string> = {
  purple: 'vision-settings-icon--purple',
  green: 'vision-settings-icon--green',
  violet: 'vision-settings-icon--violet',
  orange: 'vision-settings-icon--orange',
  red: 'vision-settings-icon--red',
}

const MORE_MENU_ITEMS: MenuProps['items'] = [
  { key: 'edit', label: '编辑模型' },
  { key: 'copy', label: '复制配置' },
  { key: 'delete', label: '删除模型' },
]

export default function VisionConfigPage({
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
}: VisionConfigPageProps) {
  const [detailForm] = Form.useForm<VisionDetailFormValues>()
  const [createForm] = Form.useForm<CreateModelFormValues>()
  const [searchText, setSearchText] = useState('')
  const [page, setPage] = useState(1)
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewProgress, setPreviewProgress] = useState(0)
  const [imageDataUrl, setImageDataUrl] = useState('')
  const [imageName, setImageName] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)

  const selectedModel = Form.useWatch('visionModel', form)

  const selectedRecord = useMemo(() => {
    return VISION_MODELS.find((item) => item.modelCode === selectedModel) ?? VISION_MODELS[0]
  }, [selectedModel])

  const currentOption = options.find((item) => item.value === selectedRecord.modelCode)

  const filteredModels = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return VISION_MODELS
    return VISION_MODELS.filter((item) => {
      return (
        item.modelName.toLowerCase().includes(keyword) ||
        item.modelCode.toLowerCase().includes(keyword) ||
        item.provider.toLowerCase().includes(keyword)
      )
    })
  }, [searchText])

  const pagedModels = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredModels.slice(start, start + PAGE_SIZE)
  }, [filteredModels, page])

  const uploadProps: UploadProps = {
    accept: '.png,.jpg,.jpeg',
    showUploadList: false,
    beforeUpload: async (file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setImageDataUrl(String(reader.result ?? ''))
        setImageName(file.name)
      }
      reader.readAsDataURL(file)
      return false
    },
  }

  useEffect(() => {
    if (!selectedModel && VISION_MODELS[0]) {
      form.setFieldValue('visionModel', VISION_MODELS[0].modelCode)
    }
  }, [form, selectedModel])

  useEffect(() => {
    setPage(1)
  }, [searchText])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE))
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [filteredModels.length, page])

  useEffect(() => {
    detailForm.setFieldsValue({
      modelName: selectedRecord.modelName,
      modelCode: selectedRecord.modelCode,
      provider: selectedRecord.provider,
      endpoint: selectedRecord.endpoint,
      resolution: selectedRecord.resolution,
      maxDuration: selectedRecord.maxDuration,
      frameRate: selectedRecord.frameRate,
      promptText: '请描述当前画面中的主体、背景、氛围和动作细节，生成适合的视频提示词。',
      negativePromptText: '',
      duration: '10 秒',
      ratio: '16:9',
      style: '写实',
      cameraMotion: '静止',
    })
    setImageDataUrl('')
    setImageName('')
    setPreviewPlaying(false)
    setPreviewProgress(0)
  }, [detailForm, selectedRecord])

  useEffect(() => {
    let timer: number | undefined
    if (previewPlaying) {
      timer = window.setInterval(() => {
        setPreviewProgress((current) => {
          const next = current + 2
          if (next >= 100) {
            setPreviewPlaying(false)
            return 100
          }
          return next
        })
      }, 160)
    }
    return () => {
      if (timer) window.clearInterval(timer)
    }
  }, [previewPlaying])

  const handleSelectModel = (item: VisionModelRecord) => {
    form.setFieldValue('visionModel', item.modelCode)
  }

  const handlePlay = (item: VisionModelRecord) => {
    handleSelectModel(item)
    setPreviewPlaying((current) => !current)
  }

  const handleSave = async () => {
    await detailForm.validateFields()
    onSave()
  }

  const handleTest = async () => {
    const values = await detailForm.validateFields()
    onTest({
      promptText: values.promptText,
      imageDataUrl,
      mode: 'vision',
    })
  }

  const handleReset = () => {
    detailForm.resetFields()
    detailForm.setFieldsValue({
      modelName: selectedRecord.modelName,
      modelCode: selectedRecord.modelCode,
      provider: selectedRecord.provider,
      endpoint: selectedRecord.endpoint,
      resolution: selectedRecord.resolution,
      maxDuration: selectedRecord.maxDuration,
      frameRate: selectedRecord.frameRate,
      promptText: '请描述当前画面中的主体、背景、氛围和动作细节，生成适合的视频提示词。',
      negativePromptText: '',
      duration: '10 秒',
      ratio: '16:9',
      style: '写实',
      cameraMotion: '静止',
    })
    setImageDataUrl('')
    setImageName('')
    setPreviewPlaying(false)
    setPreviewProgress(0)
  }

  const handleCreate = async () => {
    const values = await createForm.validateFields()
    message.success(`已新增模型：${values.modelName}`)
    setAddModalOpen(false)
    createForm.resetFields()
    onOpenManual()
  }

  return (
    <div className="vision-settings-page">
      <style>{VISION_PAGE_STYLES}</style>

      <div className="vision-settings-layout">
        <Card title="视频视觉模型列表" className="vision-settings-panel vision-settings-list-card">
          <div className="vision-settings-toolbar">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索模型名称或标识"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <Button type="primary" icon={<PlusOutlined />} className="vision-settings-primary-btn" onClick={() => setAddModalOpen(true)}>
              新增模型
            </Button>
          </div>

          <div className="vision-settings-list">
            {pagedModels.length ? (
              pagedModels.map((item) => {
                const active = item.modelCode === selectedRecord.modelCode
                const icon = item.modelName.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || 'V'
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`vision-settings-item ${active ? 'vision-settings-item--active' : ''}`}
                    onClick={() => handleSelectModel(item)}
                  >
                    <div className={`vision-settings-icon ${ICON_CLASS_MAP[item.accent]}`}>{icon}</div>
                    <div className="vision-settings-item__content">
                      <div className="vision-settings-item__title-row">
                        <div className="vision-settings-item__title">{item.modelName}</div>
                        {item.featuredLabel ? <span className="vision-settings-item__badge">{item.featuredLabel}</span> : null}
                      </div>
                      <div className="vision-settings-item__provider">提供方：{item.provider}</div>
                      <div className="vision-settings-item__meta">
                        {item.capabilities.map((tag) => (
                          <span key={tag} className="vision-settings-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="vision-settings-item__actions" onClick={(event) => event.stopPropagation()}>
                      <Button
                        type="text"
                        shape="circle"
                        className="vision-settings-icon-btn"
                        icon={previewPlaying && active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        onClick={() => handlePlay(item)}
                      />
                      <Dropdown trigger={['click']} menu={{ items: MORE_MENU_ITEMS, onClick: () => message.info('该操作为页面示意，暂未接入后端。') }}>
                        <Button type="text" shape="circle" className="vision-settings-icon-btn" icon={<EllipsisOutlined />} />
                      </Dropdown>
                    </div>
                  </button>
                )
              })
            ) : (
              <div style={{ padding: '18px 6px', color: TEXT_MUTED, fontSize: 14 }}>暂无匹配的模型数据</div>
            )}
          </div>

          <Pagination
            className="vision-settings-pagination"
            current={page}
            pageSize={PAGE_SIZE}
            total={filteredModels.length}
            size="small"
            onChange={setPage}
            hideOnSinglePage={filteredModels.length <= PAGE_SIZE}
          />
        </Card>

        <Card title="模型配置" className="vision-settings-panel">
          <div className="vision-settings-right-stack">
            <div className="vision-settings-form-section">
              <div className="vision-settings-section-title">基本信息</div>
              <Form form={detailForm} layout="vertical" disabled={loading} requiredMark={false} className="vision-settings-grid">
                <Form.Item
                  label={<span className="vision-settings-form-label">模型名称 <span className="vision-settings-form-label__required">*</span></span>}
                  name="modelName"
                  rules={[{ required: true, message: '请输入模型名称' }]}
                  className="vision-settings-control"
                >
                  <Input placeholder="请输入模型名称" />
                </Form.Item>
                <Form.Item
                  label={<span className="vision-settings-form-label">模型标识 <span className="vision-settings-form-label__required">*</span></span>}
                  name="modelCode"
                  rules={[{ required: true, message: '请输入模型标识' }]}
                  className="vision-settings-control"
                >
                  <Input placeholder="请输入模型标识" />
                </Form.Item>
                <Form.Item
                  label={<span className="vision-settings-form-label">服务提供方 <span className="vision-settings-form-label__required">*</span></span>}
                  name="provider"
                  rules={[{ required: true, message: '请选择服务提供方' }]}
                  className="vision-settings-control"
                >
                  <Select placeholder="请选择服务提供方" options={VISION_MODEL_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label={<span className="vision-settings-form-label">接口地址 <span className="vision-settings-form-label__required">*</span></span>}
                  name="endpoint"
                  rules={[{ required: true, message: '请输入接口地址' }]}
                  className="vision-settings-control"
                >
                  <Input placeholder="请输入接口地址" />
                </Form.Item>
                <Form.Item
                  label={<span className="vision-settings-form-label">分辨率 <span className="vision-settings-form-label__required">*</span></span>}
                  name="resolution"
                  rules={[{ required: true, message: '请选择分辨率' }]}
                  className="vision-settings-control"
                >
                  <Select placeholder="请选择分辨率" options={VISION_RESOLUTION_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label={<span className="vision-settings-form-label">最大时长 <span className="vision-settings-form-label__required">*</span></span>}
                  name="maxDuration"
                  rules={[{ required: true, message: '请选择最大时长' }]}
                  className="vision-settings-control"
                >
                  <Select placeholder="请选择最大时长" options={VISION_DURATION_OPTIONS} />
                </Form.Item>
                <Form.Item
                  label={<span className="vision-settings-form-label">帧率 <span className="vision-settings-form-label__required">*</span></span>}
                  name="frameRate"
                  rules={[{ required: true, message: '请选择帧率' }]}
                  className="vision-settings-control"
                >
                  <Select placeholder="请选择帧率" options={VISION_FPS_OPTIONS} />
                </Form.Item>
              </Form>

              <div className="vision-settings-status">
                <div className="vision-settings-status__item">
                  <span className="vision-settings-status__dot" />
                  <span>连接状态：</span>
                  <span className="vision-settings-status__success">已连接</span>
                </div>
                <div className="vision-settings-status__item">
                  <span>已关联场景：</span>
                  <span className="vision-settings-status__link">{selectedRecord.linkedScenes} 个</span>
                </div>
                <div className="vision-settings-status__item">
                  <span>当前提供方：</span>
                  <span>{currentOption?.provider ?? selectedRecord.provider}</span>
                </div>
                <div className="vision-settings-chip-list">
                  {selectedRecord.capabilities.map((item) => (
                    <span key={item} className="vision-settings-chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="vision-settings-form-section">
              <div className="vision-settings-section-title">视频生成测试</div>
              <div className="vision-settings-split">
                <div className="vision-settings-split__left">
                  <Form.Item
                    label={<span className="vision-settings-form-label">正向提示词 <span className="vision-settings-form-label__required">*</span></span>}
                    name="promptText"
                    rules={[{ required: true, message: '请输入正向提示词' }]}
                    className="vision-settings-control"
                  >
                    <Input.TextArea rows={3} showCount maxLength={500} placeholder="请输入正向提示词，描述画面主体、场景、构图和风格" />
                  </Form.Item>
                  <Form.Item
                    label={<span className="vision-settings-form-label">负向提示词（可选）</span>}
                    name="negativePromptText"
                    className="vision-settings-control"
                  >
                    <Input.TextArea rows={2} showCount maxLength={300} placeholder="请输入负向提示词，控制画面中不希望出现的内容" />
                  </Form.Item>

                  <div className="vision-settings-grid">
                    <div>
                      <div className="vision-settings-form-label">时长</div>
                      <div className="vision-settings-mode-row">
                        {DURATION_OPTIONS.map((item) => (
                          <Button
                            key={item}
                            className={`vision-settings-mode-btn ${detailForm.getFieldValue('duration') === item ? 'vision-settings-mode-btn--active' : ''}`}
                            onClick={() => detailForm.setFieldValue('duration', item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="vision-settings-form-label">比例</div>
                      <div className="vision-settings-mode-row">
                        {RATIO_OPTIONS.map((item) => (
                          <Button
                            key={item}
                            className={`vision-settings-mode-btn ${detailForm.getFieldValue('ratio') === item ? 'vision-settings-mode-btn--active' : ''}`}
                            onClick={() => detailForm.setFieldValue('ratio', item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="vision-settings-form-label">风格</div>
                      <div className="vision-settings-mode-row">
                        {STYLE_OPTIONS.map((item) => (
                          <Button
                            key={item}
                            className={`vision-settings-mode-btn ${detailForm.getFieldValue('style') === item ? 'vision-settings-mode-btn--active' : ''}`}
                            onClick={() => detailForm.setFieldValue('style', item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="vision-settings-form-label">运镜</div>
                      <div className="vision-settings-mode-row">
                        {CAMERA_OPTIONS.map((item) => (
                          <Button
                            key={item}
                            className={`vision-settings-mode-btn ${detailForm.getFieldValue('cameraMotion') === item ? 'vision-settings-mode-btn--active' : ''}`}
                            onClick={() => detailForm.setFieldValue('cameraMotion', item)}
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="vision-settings-form-label">图生视频参考图（可选）</div>
                    {imageDataUrl ? (
                      <div className="vision-settings-upload__preview">
                        <button
                          type="button"
                          className="vision-settings-upload__remove"
                          onClick={() => {
                            setImageDataUrl('')
                            setImageName('')
                          }}
                        >
                          ×
                        </button>
                        <img src={imageDataUrl} alt="参考图预览" />
                      </div>
                    ) : (
                      <Upload.Dragger {...uploadProps} className="vision-settings-upload">
                        <UploadOutlined style={{ fontSize: 18, color: PRIMARY_COLOR }} />
                        <div className="vision-settings-upload__title">点击或拖拽上传参考图</div>
                        <div className="vision-settings-upload__desc">支持 JPG / PNG，大小不超过 10MB</div>
                      </Upload.Dragger>
                    )}
                    {imageName ? <div className="vision-settings-help" style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>已选择：{imageName}</div> : null}
                  </div>
                </div>

                <div className="vision-settings-split__right">
                  <div className="vision-settings-preview-top">
                    <div className="vision-settings-preview-title">预览结果</div>
                    <Button size="small" onClick={() => { setPreviewPlaying(false); setPreviewProgress(0) }}>清空预览</Button>
                  </div>

                  <div className="vision-settings-preview-card">
                    <div className="vision-settings-preview-card__toolbar">
                      <Tag color="blue">已完成</Tag>
                    </div>
                    <div className="vision-settings-preview-card__inner">
                      <img src={selectedRecord.previewCover} alt="视频预览封面" />
                      <div className="vision-settings-preview-card__overlay">
                        <button type="button" className="vision-settings-preview-play" onClick={() => setPreviewPlaying((current) => !current)}>
                          {previewPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        </button>
                      </div>
                      <div className="vision-settings-player-bar">
                        <button type="button" className="vision-settings-player-button" onClick={() => setPreviewPlaying((current) => !current)}>
                          {previewPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                        </button>
                        <div className="vision-settings-player-time">0:00 / {selectedRecord.outputDuration}</div>
                        <div className="vision-settings-player-track">
                          <div className="vision-settings-player-track__progress" style={{ width: `${previewProgress}%` }} />
                        </div>
                        <div className="vision-settings-player-actions">
                          <SoundOutlined />
                          <ReloadOutlined />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="vision-settings-info-card">
                    <div className="vision-settings-info-grid">
                      <div className="vision-settings-info-title">任务信息</div>
                      <div className="vision-settings-info-item">
                        <span>任务 ID</span>
                        <span>{selectedRecord.taskId}</span>
                      </div>
                      <div className="vision-settings-info-item">
                        <span>生成时间</span>
                        <span>{selectedRecord.generatedAt}</span>
                      </div>
                      <div className="vision-settings-info-item">
                        <span>状态</span>
                        <span style={{ color: SUCCESS_COLOR }}>已完成</span>
                      </div>
                    </div>
                    <div className="vision-settings-info-grid" style={{ borderTop: `1px solid ${CARD_BORDER}` }}>
                      <div className="vision-settings-info-title">输出规格</div>
                      <div className="vision-settings-info-item">
                        <span>分辨率</span>
                        <span>{selectedRecord.outputResolution}</span>
                      </div>
                      <div className="vision-settings-info-item">
                        <span>时长</span>
                        <span>{selectedRecord.outputDuration}</span>
                      </div>
                      <div className="vision-settings-info-item">
                        <span>帧率</span>
                        <span>{selectedRecord.outputFrameRate}</span>
                      </div>
                      <div className="vision-settings-info-item">
                        <span>格式</span>
                        <span>{selectedRecord.outputFormat}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="vision-settings-action-row">
              <Button type="primary" className="vision-settings-save-btn" loading={saving} onClick={() => void handleSave()}>
                保存设置
              </Button>
              <Button className="vision-settings-border-btn" loading={testing} onClick={() => void handleTest()}>
                测试当前模型
              </Button>
              <Button className="vision-settings-default-btn" onClick={handleReset}>
                重置表单
              </Button>
            </div>

            <div className="vision-settings-footer-note">
              <span>提示：</span>
              <span>此模型将用于景区宣传片、数字人背景视频及各类视觉内容生成任务，请根据业务需求谨慎调整参数配置</span>
            </div>
          </div>
        </Card>
      </div>

      <Modal
        open={addModalOpen}
        title="新增模型"
        onCancel={() => setAddModalOpen(false)}
        destroyOnClose
        footer={[
          <Button key="manual" onClick={onOpenManual}>
            去手动维护
          </Button>,
          <Button key="cancel" onClick={() => setAddModalOpen(false)}>
            取消
          </Button>,
          <Button key="ok" type="primary" onClick={() => void handleCreate()}>
            确认新增
          </Button>,
        ]}
        className="vision-settings-modal"
      >
        <Form form={createForm} layout="vertical" requiredMark={false} className="vision-settings-modal__grid">
          <Form.Item
            label={<span className="vision-settings-modal__label">模型名称 <span className="vision-settings-modal__required">*</span></span>}
            name="modelName"
            rules={[{ required: true, message: '请输入模型名称' }]}
            className="vision-settings-modal__field"
          >
            <Input placeholder="请输入模型名称" />
          </Form.Item>
          <Form.Item
            label={<span className="vision-settings-modal__label">模型标识 <span className="vision-settings-modal__required">*</span></span>}
            name="modelCode"
            rules={[{ required: true, message: '请输入模型标识' }]}
            className="vision-settings-modal__field"
          >
            <Input placeholder="请输入模型标识" />
          </Form.Item>
          <Form.Item
            label={<span className="vision-settings-modal__label">服务提供方 <span className="vision-settings-modal__required">*</span></span>}
            name="provider"
            rules={[{ required: true, message: '请输入服务提供方' }]}
            className="vision-settings-modal__field"
          >
            <Input placeholder="请输入服务提供方" />
          </Form.Item>
          <Form.Item
            label={<span className="vision-settings-modal__label">接口地址 <span className="vision-settings-modal__required">*</span></span>}
            name="endpoint"
            rules={[{ required: true, message: '请输入接口地址' }]}
            className="vision-settings-modal__field"
          >
            <Input placeholder="请输入接口地址" />
          </Form.Item>
        </Form>
      </Modal>

      <div style={{ display: 'none' }}>
        {result}
        {testResult?.message}
      </div>
    </div>
  )
}
