import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import type { TextAreaRef } from 'antd/es/input/TextArea'
import {
  ArrowLeftOutlined,
  BoldOutlined,
  BookOutlined,
  BranchesOutlined,
  CheckCircleFilled,
  CodeOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileAddOutlined,
  FolderFilled,
  FullscreenOutlined,
  ItalicOutlined,
  LinkOutlined,
  MoreOutlined,
  OrderedListOutlined,
  PictureOutlined,
  PlusOutlined,
  RedoOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  StrikethroughOutlined,
  TagsOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  createKnowledgeAccount,
  deleteKnowledgeAccount,
  extractRecords,
  extractTotal,
  getDocumentParagraphs,
  getDocumentParagraphProblems,
  getKnowledgeAssetUrl,
  getKnowledgeDocuments,
  getKnowledges,
  listKnowledgeAccountEnvironments,
  listKnowledgeAccounts,
  syncKnowledgeOpenApiKeys,
  testKnowledgeAccount,
  updateKnowledgeAccount,
  updateKnowledgeAccountStatus,
  updateDocumentParagraph,
  type MaxKbAccount,
  type MaxKbAccountPayload,
  type MaxKbEnvironmentOption,
  type MaxKbOpenApiKey,
  type MaxKbRecord,
  type ParagraphProblemPayload,
} from '../api/knowledgeOpenApi'
import MaxKbDocumentUploadWorkbench from './knowledge-openapi/MaxKbDocumentUploadWorkbench'

type BrowserView = 'knowledge' | 'documents' | 'paragraphs' | 'upload'
type KnowledgeRow = MaxKbRecord & { key: string; idText: string; nameText: string; contentText: string }
type DocumentRow = MaxKbRecord & { key: string; idText: string; nameText: string; contentText: string }
type ParagraphRow = MaxKbRecord & { key: string; idText: string; nameText: string; contentText: string }
type NoticeState = { type: 'success' | 'info' | 'warning' | 'error'; text: string } | null
type AccountFormState = MaxKbAccountPayload & { id?: number }

const EMPTY_ACCOUNT_FORM: AccountFormState = {
  accountName: '',
  baseUrl: '',
  environment: 'local',
  workspaceId: 'default',
  apiKey: '',
  managementToken: '',
  remark: '',
  status: 1,
}

const EMPTY_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

const { Text, Paragraph } = Typography

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
    case 401:
    case 403:
      return '请检查 MaxKB 地址、工作空间和 API Key 是否正确'
    case 404:
      return 'MaxKB 资源不存在，请检查知识库或文档 ID'
    case 502:
      return '上游 MaxKB 服务不可用，请确认服务已启动'
    case 503:
    case 504:
      return 'MaxKB 服务响应超时，请稍后重试'
    default:
      if (status >= 500) {
        return '服务器异常，请稍后重试'
      }
      if (status >= 400) {
        return `请求失败（HTTP ${status}）`
      }
      return '请求未能完成，请稍后重试'
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
    return '请检查 MaxKB 地址和 API Key 是否正确'
  }
  if (status === 401 || lowerMessage.includes('unauthorized') || lowerMessage.includes('authentication')) {
    return '请检查 MaxKB 地址和 API Key 是否正确'
  }
  if (status === 403 || lowerMessage.includes('permission') || lowerMessage.includes('forbidden')) {
    return '当前 API Key 没有访问该知识库的权限'
  }
  if (lowerMessage.includes('not found')) {
    return 'MaxKB 资源不存在，请检查知识库或文档 ID'
  }

  if (parsed) {
    if (typeof code === 'number' || typeof code === 'string') {
      return `MaxKB 返回错误，错误码：${code}`
    }
    return status ? friendlyStatusMessage(status) : 'MaxKB 返回异常响应，请检查接口配置'
  }

  return truncate(raw)
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
    return error.message || '未知网络错误'
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

function numberText(value: unknown, fallback = '-') {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw)) {
    return fallback
  }
  if (raw >= 1000) {
    return `${(raw / 1000).toFixed(raw >= 10000 ? 1 : 1)}k`
  }
  return String(raw)
}

function dateText(record: MaxKbRecord, keys: string[]) {
  return textOf(record, keys, '-')
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isMaxKbAssetUrl(value: string) {
  const normalized = value.trim().replace(/^\.\/+/, '/')
  return normalized.startsWith('oss/file/')
    || normalized.startsWith('.oss/file/')
    || normalized.startsWith('/oss/file/')
    || normalized.startsWith('/.oss/file/')
    || normalized.startsWith('/admin/oss/file/')
    || normalized.includes('/oss/file/')
    || normalized.includes('/.oss/file/')
}

function normalizeMaxKbAssetPath(rawUrl: string) {
  let value = rawUrl.trim()
  if (!value || /^(data:image\/|blob:)/i.test(value)) {
    return ''
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const source = new URL(value)
      value = `${source.pathname}${source.search}`
    } catch {
      return ''
    }
  }
  while (value.startsWith('./')) {
    value = value.slice(1)
  }
  if (!value.startsWith('/')) {
    value = `/${value}`
  }
  while (value.startsWith('/./')) {
    value = value.slice(2)
  }

  const hiddenMarker = '/.oss/file/'
  const hiddenIndex = value.indexOf(hiddenMarker)
  if (hiddenIndex >= 0) {
    return value.slice(hiddenIndex)
  }

  const marker = '/oss/file/'
  const index = value.indexOf(marker)
  return index >= 0 ? value.slice(index) : value
}

function directMaxKbAssetUrl(rawUrl: string, assetBaseUrl: string) {
  const trimmed = rawUrl.trim()
  if (!trimmed || !assetBaseUrl || !isMaxKbAssetUrl(trimmed)) {
    return ''
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const source = new URL(trimmed)
      const base = new URL(assetBaseUrl)
      if (source.origin === base.origin) {
        return source.toString()
      }
    } catch {
      return ''
    }
  }
  const path = normalizeMaxKbAssetPath(trimmed)
  if (!path || !isMaxKbAssetUrl(path)) {
    return ''
  }
  try {
    return new URL(path, `${assetBaseUrl.replace(/\/$/, '')}/`).toString()
  } catch {
    return ''
  }
}

function proxiedAssetPath(value: string) {
  try {
    const url = new URL(value, window.location.href)
    if (url.pathname.endsWith('/api/admin/knowledge/assets') || (
      url.pathname.includes('/api/admin/knowledge/maxkb/accounts/')
      && url.pathname.endsWith('/assets')
    )) {
      return url.searchParams.get('path') || ''
    }
  } catch {
    return ''
  }
  return ''
}

function isKnowledgeAssetProxyUrl(value: string) {
  try {
    const url = new URL(value, window.location.href)
    return url.pathname.endsWith('/api/admin/knowledge/assets') || (
      url.pathname.includes('/api/admin/knowledge/maxkb/accounts/')
      && url.pathname.endsWith('/assets')
    )
  } catch {
    return false
  }
}

function normalizeResourceUrl(rawUrl: string, assetBaseUrl: string, accountId?: number) {
  const trimmed = rawUrl.trim()
  if (!trimmed || /^javascript:/i.test(trimmed)) {
    return ''
  }
  if (isMaxKbAssetUrl(trimmed)) {
    if (/^https?:\/\//i.test(trimmed) && assetBaseUrl) {
      try {
        const source = new URL(trimmed)
        const base = new URL(assetBaseUrl)
        if (source.origin !== base.origin) {
          return trimmed
        }
      } catch {
        return ''
      }
    }
    return getKnowledgeAssetUrl(trimmed, accountId)
  }
  if (/^(data:image\/|blob:|https?:\/\/|\/\/)/i.test(trimmed)) {
    return trimmed
  }
  if (!assetBaseUrl) {
    return trimmed
  }
  try {
    const resolved = new URL(trimmed, `${assetBaseUrl.replace(/\/$/, '')}/`).toString()
    return isMaxKbAssetUrl(resolved) ? getKnowledgeAssetUrl(resolved, accountId) : resolved
  } catch {
    return trimmed
  }
}

function sanitizeHtml(value: string, assetBaseUrl: string, accountId?: number) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|form|input|button|meta|link|base)[^>]*>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/\s(src|href)=("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, attr: string, _quoted: string, doubleUrl?: string, singleUrl?: string, bareUrl?: string) => {
      const url = normalizeResourceUrl(doubleUrl ?? singleUrl ?? bareUrl ?? '', assetBaseUrl, accountId)
      const lowerAttr = attr.toLowerCase()
      if (!url) {
        return ''
      }
      if (lowerAttr === 'src' && isKnowledgeAssetProxyUrl(url)) {
        return ` src="${EMPTY_IMAGE_SRC}" data-proxy-src="${escapeHtml(url)}"`
      }
      return ` ${lowerAttr}="${escapeHtml(url)}"`
    })
}

function renderInlineMarkdown(value: string, assetBaseUrl: string, accountId?: number) {
  const chunks: string[] = []
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = imagePattern.exec(value)) !== null) {
    chunks.push(escapeHtml(value.slice(lastIndex, match.index)))
    const src = normalizeResourceUrl(match[2], assetBaseUrl, accountId)
    if (src) {
      const directSrc = directMaxKbAssetUrl(match[2], assetBaseUrl)
      const shouldProxyWithAuth = isKnowledgeAssetProxyUrl(src)
      chunks.push(
        `<img src="${escapeHtml(shouldProxyWithAuth ? EMPTY_IMAGE_SRC : src)}" alt="${escapeHtml(match[1])}" loading="lazy" data-mkb-src="${escapeHtml(match[2])}"${
          shouldProxyWithAuth ? ` data-proxy-src="${escapeHtml(src)}"` : ''
        }${
          directSrc ? ` data-fallback-src="${escapeHtml(directSrc)}"` : ''
        } />`,
      )
    }
    lastIndex = match.index + match[0].length
  }

  chunks.push(escapeHtml(value.slice(lastIndex)))

  return chunks
    .join('')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function isMarkdownTableSeparator(line: string) {
  const cells = splitTableRow(line)
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function renderMarkdownTable(lines: string[], assetBaseUrl: string, accountId?: number) {
  const [headerLine, , ...bodyLines] = lines
  const headers = splitTableRow(headerLine)
  const bodyRows = bodyLines.map(splitTableRow)
  return [
    '<table>',
    '<thead><tr>',
    ...headers.map((header) => `<th>${renderInlineMarkdown(header, assetBaseUrl, accountId)}</th>`),
    '</tr></thead>',
    '<tbody>',
    ...bodyRows.map((row) => `<tr>${headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] ?? '', assetBaseUrl, accountId)}</td>`).join('')}</tr>`),
    '</tbody>',
    '</table>',
  ].join('')
}

function markdownToHtml(markdown: string, assetBaseUrl: string, accountId?: number) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraphLines: string[] = []
  let index = 0

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join('\n'), assetBaseUrl, accountId).replace(/\n/g, '<br />')}</p>`)
    paragraphLines = []
  }

  while (index < lines.length) {
    const rawLine = lines[index]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      flushParagraph()
      index += 1
      continue
    }

    if (index + 1 < lines.length && rawLine.includes('|') && isMarkdownTableSeparator(lines[index + 1])) {
      flushParagraph()
      const tableLines = [rawLine, lines[index + 1]]
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        tableLines.push(lines[index])
        index += 1
      }
      blocks.push(renderMarkdownTable(tableLines, assetBaseUrl, accountId))
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      const level = Math.min(heading[1].length + 1, 5)
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2], assetBaseUrl, accountId)}</h${level}>`)
      index += 1
      continue
    }

    const unorderedItem = /^[-*+]\s+(.+)$/.exec(trimmed)
    const orderedItem = /^\d+[.)]\s+(.+)$/.exec(trimmed)
    if (unorderedItem || orderedItem) {
      flushParagraph()
      const ordered = Boolean(orderedItem)
      const items: string[] = []
      while (index < lines.length) {
        const current = lines[index].trim()
        const currentMatch = ordered ? /^\d+[.)]\s+(.+)$/.exec(current) : /^[-*+]\s+(.+)$/.exec(current)
        if (!currentMatch) {
          break
        }
        items.push(`<li>${renderInlineMarkdown(currentMatch[1], assetBaseUrl, accountId)}</li>`)
        index += 1
      }
      blocks.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }

    paragraphLines.push(rawLine)
    index += 1
  }

  flushParagraph()
  return blocks.join('\n')
}

function richContentHtml(rawContent: string, assetBaseUrl: string, accountId?: number) {
  const raw = rawContent.trim()
  if (!raw) {
    return ''
  }
  if (/<(?:table|thead|tbody|tr|td|th|img|h[1-6]|p|ul|ol|li|br|strong|em|div|span)\b/i.test(raw)) {
    return sanitizeHtml(raw, assetBaseUrl, accountId)
  }
  return markdownToHtml(raw, assetBaseUrl, accountId)
}

function looksLikeImageUrl(value: string) {
  return /^(?:data:image\/|blob:|https?:\/\/|\/\/|\/|\.{1,2}\/).+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#].*)?$/i.test(value.trim())
}

function collectImageUrls(value: unknown, assetBaseUrl: string, accountId?: number, urls = new Set<string>(), depth = 0) {
  if (value == null || depth > 4) {
    return urls
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, assetBaseUrl, accountId, urls, depth + 1))
    return urls
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectImageUrls(item, assetBaseUrl, accountId, urls, depth + 1))
    return urls
  }
  if (typeof value !== 'string') {
    return urls
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return urls
  }

  if ((trimmed.startsWith('{') || trimmed.startsWith('[')) && trimmed.length < 10000) {
    try {
      collectImageUrls(JSON.parse(trimmed), assetBaseUrl, accountId, urls, depth + 1)
    } catch {
      // Ignore non-JSON strings.
    }
  }

  const htmlImagePattern = /<img[^>]+src=["']([^"']+)["']/gi
  const markdownImagePattern = /!\[[^\]]*]\(([^)]+)\)/g
  const imageUrlPattern = /(?:data:image\/[^"'\s<>)]*|(?:https?:)?\/\/[^"'\s<>)]*|(?:\/|\.{1,2}\/)[^"'\s<>)]*)\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#][^"'\s<>)]*)?/gi
  let match: RegExpExecArray | null

  while ((match = htmlImagePattern.exec(trimmed)) !== null) {
    const url = normalizeResourceUrl(match[1], assetBaseUrl, accountId)
    if (url) urls.add(url)
  }
  while ((match = markdownImagePattern.exec(trimmed)) !== null) {
    const url = normalizeResourceUrl(match[1], assetBaseUrl, accountId)
    if (url) urls.add(url)
  }
  while ((match = imageUrlPattern.exec(trimmed)) !== null) {
    const url = normalizeResourceUrl(match[0], assetBaseUrl, accountId)
    if (url) urls.add(url)
  }

  if (looksLikeImageUrl(trimmed) || isMaxKbAssetUrl(trimmed)) {
    const url = normalizeResourceUrl(trimmed, assetBaseUrl, accountId)
    if (url) urls.add(url)
  }

  return urls
}

function extractRecordImages(record: MaxKbRecord, assetBaseUrl: string, accountId?: number) {
  const imageKeys = ['image', 'images', 'img', 'imgs', 'picture', 'pictures', 'screenshot', 'screenshots', 'thumbnail', 'preview', 'media', 'metadata', 'meta']
  const urls = new Set<string>()

  Object.entries(record).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase()
    if (imageKeys.some((imageKey) => normalizedKey.includes(imageKey))) {
      collectImageUrls(value, assetBaseUrl, accountId, urls)
    }
  })

  return Array.from(urls)
}

function parseJsonValue(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function problemItemText(value: unknown) {
  if (typeof value === 'string') {
    return value.trim()
  }
  if (!value || typeof value !== 'object') {
    return ''
  }
  return textOf(value as MaxKbRecord, ['content', 'question', 'problem_text', 'title', 'name'], '').trim()
}

function normalizeProblemList(value: unknown): ParagraphProblemPayload[] {
  if (typeof value === 'string') {
    const parsed = parseJsonValue(value)
    if (parsed) {
      return normalizeProblemList(parsed)
    }
    const text = value.trim()
    return text ? [{ content: text }] : []
  }
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  return value.flatMap((item) => {
    const content = problemItemText(item)
    if (!content || seen.has(content)) {
      return []
    }
    seen.add(content)
    if (item && typeof item === 'object') {
      const id = textOf(item as MaxKbRecord, ['id', 'problem_id'], '').trim()
      return [{ ...(id ? { id } : {}), content }]
    }
    return [{ content }]
  })
}

function recordProblemList(record: MaxKbRecord) {
  return normalizeProblemList(record.problem_list ?? record.problemList ?? record.problems ?? record.problem)
}

function RichDocumentContent({ accountId, assetBaseUrl, record }: { accountId?: number; assetBaseUrl: string; record: ParagraphRow }) {
  const contentRef = useRef<HTMLDivElement | null>(null)
  const html = useMemo(() => richContentHtml(record.contentText, assetBaseUrl, accountId), [accountId, assetBaseUrl, record.contentText])
  const images = useMemo(() => {
    const renderedUrls = collectImageUrls(record.contentText, assetBaseUrl, accountId)
    return extractRecordImages(record, assetBaseUrl, accountId).filter((url) => !renderedUrls.has(url))
  }, [accountId, assetBaseUrl, record])

  useEffect(() => {
    const root = contentRef.current
    if (!root) {
      return undefined
    }

    const cleanups: Array<() => void> = []
    root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      let cancelled = false
      let objectUrl = ''

      const removeTip = () => {
        if (img.nextElementSibling?.classList.contains('mkb-image-error-tip')) {
          img.nextElementSibling.remove()
        }
      }

      const showErrorTip = () => {
        img.classList.add('is-error')
        const source = img.getAttribute('data-mkb-src') || proxiedAssetPath(img.src) || img.src
        img.setAttribute('data-error-src', source)
        if (img.nextElementSibling?.classList.contains('mkb-image-error-tip')) {
          img.nextElementSibling.textContent = '图片加载失败'
          return
        }
        const tip = document.createElement('span')
        tip.className = 'mkb-image-error-tip'
        tip.textContent = '图片加载失败'
        tip.title = source
        img.insertAdjacentElement('afterend', tip)
      }

      const tryDirectFallback = () => {
        const fallback =
          img.getAttribute('data-fallback-src')
          || directMaxKbAssetUrl(img.getAttribute('data-mkb-src') || proxiedAssetPath(img.src), assetBaseUrl)
        if (!fallback || img.dataset.directTried === 'true' || fallback === img.src) {
          return false
        }
        img.dataset.directTried = 'true'
        img.src = fallback
        return true
      }

      const loadViaAuthenticatedProxy = async (proxySrc: string) => {
        try {
          const response = await axios.get<Blob>(proxySrc, { responseType: 'blob' })
          if (cancelled) {
            return
          }
          objectUrl = URL.createObjectURL(response.data)
          img.src = objectUrl
          img.classList.remove('is-error')
          removeTip()
        } catch {
          if (!cancelled && !tryDirectFallback()) {
            showErrorTip()
          }
        }
      }

      const onError = () => {
        if (tryDirectFallback()) {
          return
        }
        showErrorTip()
      }

      const onLoad = () => {
        img.classList.remove('is-error')
        removeTip()
      }

      img.addEventListener('error', onError)
      img.addEventListener('load', onLoad)
      const proxySrc = img.getAttribute('data-proxy-src')
      if (proxySrc) {
        void loadViaAuthenticatedProxy(proxySrc)
      } else if (img.complete && img.naturalWidth === 0) {
        onError()
      }
      cleanups.push(() => {
        cancelled = true
        img.removeEventListener('error', onError)
        img.removeEventListener('load', onLoad)
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl)
        }
      })
    })

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [assetBaseUrl, html, images])

  if (!html && images.length === 0) {
    return <p className="mkb-rich-empty">{shortText(record, 260)}</p>
  }

  return (
    <div className="mkb-document-rich" ref={contentRef}>
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
      {images.length > 0 ? (
        <div className="mkb-rich-image-list">
          {images.map((url) => (
            <img
              key={url}
              src={isKnowledgeAssetProxyUrl(url) ? EMPTY_IMAGE_SRC : url}
              alt=""
              loading="lazy"
              data-mkb-src={proxiedAssetPath(url)}
              data-proxy-src={isKnowledgeAssetProxyUrl(url) ? url : undefined}
              data-fallback-src={directMaxKbAssetUrl(proxiedAssetPath(url) || url, assetBaseUrl)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function statusOf(record: DocumentRow) {
  const rawValue =
    record.status ??
    record.state ??
    record.sync_status ??
    record.index_status ??
    record.embedding_status

  if (rawValue == null || rawValue === '') {
    return { text: '成功', color: 'success' }
  }

  const normalized = String(rawValue).trim().toLowerCase()
  const knownStatuses: Record<string, { text: string; color?: string }> = {
    '1': { text: '成功', color: 'success' },
    '2': { text: '处理中', color: 'processing' },
    '3': { text: '成功', color: 'success' },
    '4': { text: '失败', color: 'error' },
    success: { text: '成功', color: 'success' },
    successful: { text: '成功', color: 'success' },
    completed: { text: '成功', color: 'success' },
    complete: { text: '成功', color: 'success' },
    done: { text: '成功', color: 'success' },
    processing: { text: '处理中', color: 'processing' },
    running: { text: '处理中', color: 'processing' },
    pending: { text: '等待中', color: 'warning' },
    failed: { text: '失败', color: 'error' },
    fail: { text: '失败', color: 'error' },
    error: { text: '失败', color: 'error' },
    成功: { text: '成功', color: 'success' },
    完成: { text: '成功', color: 'success' },
    已完成: { text: '成功', color: 'success' },
    处理中: { text: '处理中', color: 'processing' },
    等待中: { text: '等待中', color: 'warning' },
    失败: { text: '失败', color: 'error' },
  }

  return knownStatuses[normalized] ?? { text: String(rawValue).trim(), color: 'default' }
}

function enabledOf(record: DocumentRow) {
  const rawValue = record.is_active ?? record.enabled ?? record.active
  if (rawValue == null || rawValue === '') {
    return true
  }
  if (typeof rawValue === 'boolean') {
    return rawValue
  }
  return !['0', 'false', 'disabled', 'disable', '停用', '禁用'].includes(String(rawValue).trim().toLowerCase())
}

function makeRows(records: MaxKbRecord[], type: 'knowledge' | 'document' | 'paragraph') {
  return records.map((record, index) => {
    const idText = textOf(record, ['id', 'knowledge_id', 'document_id', 'paragraph_id'], String(index + 1))
    const nameText = textOf(record, ['name', 'document_name', 'knowledge_name', 'title'], idText)
    const contentText = textOf(record, ['content', 'content_text', 'text', 'paragraph_content', 'raw_content', 'html', 'markdown', 'md', 'desc', 'description'], '')
    return { ...record, key: `${type}-${idText}-${index}`, idText, nameText, contentText }
  })
}

function matchesSearch(record: MaxKbRecord & { nameText?: string; contentText?: string }, keyword: string) {
  const query = keyword.trim().toLowerCase()
  if (!query) {
    return true
  }
  return [
    record.nameText,
    record.contentText,
    record.idText,
    record.title,
    record.create_user,
    record.creator,
  ].some((value) => String(value ?? '').toLowerCase().includes(query))
}

export default function KnowledgeOpenApiPage() {
  const [view, setView] = useState<BrowserView>('knowledge')
  const [loadingKnowledges, setLoadingKnowledges] = useState(false)
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [loadingParagraphs, setLoadingParagraphs] = useState(false)
  const [notice, setNotice] = useState<NoticeState>(null)
  const [knowledges, setKnowledges] = useState<KnowledgeRow[]>([])
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [paragraphs, setParagraphs] = useState<ParagraphRow[]>([])
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState('')
  const [selectedDocumentId, setSelectedDocumentId] = useState('')
  const [knowledgeTotal, setKnowledgeTotal] = useState(0)
  const [documentTotal, setDocumentTotal] = useState(0)
  const [paragraphTotal, setParagraphTotal] = useState(0)
  const [knowledgeSearch, setKnowledgeSearch] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [paragraphSearch, setParagraphSearch] = useState('')
  const [documentSearchType, setDocumentSearchType] = useState<'name' | 'creator'>('name')
  const [paragraphSearchType, setParagraphSearchType] = useState<'title' | 'content'>('title')
  const [detailRecord, setDetailRecord] = useState<MaxKbRecord | null>(null)
  const [assetBaseUrl, setAssetBaseUrl] = useState('')
  const [accounts, setAccounts] = useState<MaxKbAccount[]>([])
  const [accountTotal, setAccountTotal] = useState(0)
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>()
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [accountEnvironments, setAccountEnvironments] = useState<MaxKbEnvironmentOption[]>([])
  const [configOpen, setConfigOpen] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [testingAccountId, setTestingAccountId] = useState<number | undefined>()
  const [syncingKeys, setSyncingKeys] = useState(false)
  const [accountForm, setAccountForm] = useState<AccountFormState>(EMPTY_ACCOUNT_FORM)
  const [syncedKeys, setSyncedKeys] = useState<MaxKbOpenApiKey[]>([])
  const [editingParagraph, setEditingParagraph] = useState<ParagraphRow | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editProblems, setEditProblems] = useState<ParagraphProblemPayload[]>([])
  const [problemInputVisible, setProblemInputVisible] = useState(false)
  const [newProblemText, setNewProblemText] = useState('')
  const [loadingParagraphProblems, setLoadingParagraphProblems] = useState(false)
  const [savingParagraph, setSavingParagraph] = useState(false)
  const documentsRequestSeq = useRef(0)
  const editContentInputRef = useRef<TextAreaRef>(null)
  const selectedAccountIdRef = useRef<number | undefined>(undefined)

  const selectedKnowledge = useMemo(
    () => knowledges.find((item) => item.idText === selectedKnowledgeId),
    [knowledges, selectedKnowledgeId],
  )
  const selectedDocument = useMemo(
    () => documents.find((item) => item.idText === selectedDocumentId),
    [documents, selectedDocumentId],
  )
  const selectedAccount = useMemo(
    () => accounts.find((item) => item.id === selectedAccountId),
    [accounts, selectedAccountId],
  )

  const filteredKnowledges = useMemo(
    () => knowledges.filter((item) => matchesSearch(item, knowledgeSearch)),
    [knowledges, knowledgeSearch],
  )
  const filteredDocuments = useMemo(
    () => documents.filter((item) => {
      if (!documentSearch.trim()) return true
      if (documentSearchType === 'creator') {
        return String(item.create_user ?? item.creator ?? '').toLowerCase().includes(documentSearch.trim().toLowerCase())
      }
      return matchesSearch(item, documentSearch)
    }),
    [documentSearch, documentSearchType, documents],
  )
  const filteredParagraphs = useMemo(
    () => paragraphs.filter((item) => {
      if (!paragraphSearch.trim()) return true
      const value = paragraphSearchType === 'title' ? item.nameText : item.contentText
      return String(value ?? '').toLowerCase().includes(paragraphSearch.trim().toLowerCase())
    }),
    [paragraphSearch, paragraphSearchType, paragraphs],
  )

  useEffect(() => {
    selectedAccountIdRef.current = selectedAccountId
  }, [selectedAccountId])

  function notify(type: NonNullable<NoticeState>['type'], text: string) {
    setNotice({ type, text })
  }

  function accountAssetOrigin(account?: Pick<MaxKbAccount, 'baseUrl'> | Pick<AccountFormState, 'baseUrl'>) {
    const baseUrl = account?.baseUrl?.trim()
    if (!baseUrl) {
      return ''
    }
    try {
      return new URL(baseUrl).origin
    } catch {
      return ''
    }
  }

  function resetBrowserState() {
    setView('knowledge')
    setKnowledges([])
    setDocuments([])
    setParagraphs([])
    setSelectedKnowledgeId('')
    setSelectedDocumentId('')
    setKnowledgeTotal(0)
    setDocumentTotal(0)
    setParagraphTotal(0)
  }

  const loadAccountEnvironments = useCallback(async () => {
    try {
      const environments = await listKnowledgeAccountEnvironments()
      setAccountEnvironments(environments)
    } catch {
      setAccountEnvironments([])
    }
  }, [])

  const loadAccounts = useCallback(async (preferredAccountId?: number, silent = false) => {
    if (!silent) {
      setLoadingAccounts(true)
    }
    try {
      const page = await listKnowledgeAccounts({ current: 1, size: 100 })
      const rows = page.records ?? []
      const nextAccount =
        rows.find((item) => item.id === preferredAccountId)
        ?? rows.find((item) => item.id === selectedAccountIdRef.current)
        ?? rows.find((item) => item.status === 1)
        ?? rows[0]

      setAccounts(rows)
      setAccountTotal(page.total ?? rows.length)
      setSelectedAccountId(nextAccount?.id)
      setAssetBaseUrl(accountAssetOrigin(nextAccount))
      if (!nextAccount) {
        resetBrowserState()
      }
    } catch (error) {
      setAccounts([])
      setAccountTotal(0)
      setSelectedAccountId(undefined)
      setAssetBaseUrl('')
      resetBrowserState()
      if (!silent) {
        notify('error', `连接配置加载失败：${extractErrorMessage(error)}`)
      }
    } finally {
      if (!silent) {
        setLoadingAccounts(false)
      }
    }
  }, [])

  const loadKnowledges = useCallback(async () => {
    if (!selectedAccountId) {
      setKnowledges([])
      setKnowledgeTotal(0)
      return
    }
    setLoadingKnowledges(true)
    try {
      const payload = await getKnowledges(selectedAccountId, { page: 1, size: 100 })
      const rows = makeRows(extractRecords(payload), 'knowledge') as KnowledgeRow[]
      setKnowledges(rows)
      setKnowledgeTotal(extractTotal(payload, rows.length))
      setSelectedKnowledgeId((currentId) => (currentId && rows.some((item) => item.idText === currentId) ? currentId : ''))
    } catch (error) {
      notify('error', `知识库列表加载失败：${extractErrorMessage(error)}`)
    } finally {
      setLoadingKnowledges(false)
    }
  }, [selectedAccountId])

  function updateAccountField<K extends keyof AccountFormState>(key: K, value: AccountFormState[K]) {
    setAccountForm((current) => ({ ...current, [key]: value }))
  }

  function openConfigDrawer() {
    setConfigOpen(true)
    void loadAccounts(undefined, true)
    void loadAccountEnvironments()
    if (selectedAccount) {
      editAccount(selectedAccount)
    } else {
      createAccountDraft()
    }
  }

  function createAccountDraft() {
    setAccountForm(EMPTY_ACCOUNT_FORM)
    setSyncedKeys([])
  }

  function editAccount(account: MaxKbAccount) {
    setAccountForm({
      id: account.id,
      accountName: account.accountName,
      baseUrl: account.baseUrl,
      environment: account.environment || 'local',
      apiKey: '',
      managementToken: '',
      workspaceId: account.workspaceId || 'default',
      remark: account.remark || '',
      status: account.status ?? 1,
    })
    setSyncedKeys([])
  }

  function selectAccount(accountId: number) {
    const account = accounts.find((item) => item.id === accountId)
    setSelectedAccountId(accountId)
    setAssetBaseUrl(accountAssetOrigin(account))
    resetBrowserState()
  }

  async function saveAccount() {
    if (!accountForm.accountName.trim() || !accountForm.baseUrl.trim() || !accountForm.workspaceId.trim()) {
      message.warning('请填写账号名称、MaxKB 地址和工作空间 ID')
      return
    }
    if (!accountForm.id && !accountForm.apiKey?.trim()) {
      message.warning('新增连接配置时必须填写 OpenAPI Key')
      return
    }

    setSavingAccount(true)
    try {
      const payload: MaxKbAccountPayload = {
        accountName: accountForm.accountName.trim(),
        baseUrl: accountForm.baseUrl.trim(),
        environment: accountForm.environment || 'local',
        apiKey: accountForm.apiKey?.trim() || undefined,
        managementToken: accountForm.managementToken?.trim() || undefined,
        workspaceId: accountForm.workspaceId.trim(),
        remark: accountForm.remark?.trim() || undefined,
        status: accountForm.status ?? 1,
      }
      const savedAccount = accountForm.id
        ? await updateKnowledgeAccount(accountForm.id, payload)
        : await createKnowledgeAccount(payload)
      message.success(accountForm.id ? '连接配置已更新' : '连接配置已新增')
      editAccount(savedAccount)
      void loadAccounts(savedAccount.id, true)
    } catch (error) {
      message.error(`连接配置保存失败：${extractErrorMessage(error)}`)
    } finally {
      setSavingAccount(false)
    }
  }

  async function syncKeys() {
    const managementToken = accountForm.managementToken?.trim() || ''
    if (!managementToken) {
      message.warning('请输入 MaxKB 管理端 Token')
      return
    }
    setSyncingKeys(true)
    try {
      const payload = await syncKnowledgeOpenApiKeys({
        adminBaseUrl: accountForm.baseUrl || 'http://localhost:3000',
        workspaceId: accountForm.workspaceId || 'default',
        adminToken: managementToken,
      })
      setAccountForm((current) => ({
        ...current,
        baseUrl: payload.adminBaseUrl || current.baseUrl,
        workspaceId: payload.workspaceId || current.workspaceId,
      }))
      setSyncedKeys(payload.keys || [])
      message.success(payload.keys?.length ? '已同步 OpenAPI Key' : '同步完成，但没有读取到可用 Key')
    } catch (error) {
      message.error(`同步 Key 失败：${extractErrorMessage(error)}`)
    } finally {
      setSyncingKeys(false)
    }
  }

  function selectSyncedKey(keyId: string) {
    const selectedKey = syncedKeys.find((item) => String(item.id ?? item.name ?? item.secret_key ?? '') === keyId)
    if (!selectedKey) {
      return
    }
    setAccountForm((current) => ({
      ...current,
      accountName: current.accountName || selectedKey.name || current.accountName,
      apiKey: selectedKey.secret_key ?? current.apiKey,
    }))
  }

  async function removeAccount(accountId: number) {
    try {
      await deleteKnowledgeAccount(accountId)
      message.success('连接配置已删除')
      if (accountForm.id === accountId) {
        createAccountDraft()
      }
      void loadAccounts(undefined, true)
    } catch (error) {
      message.error(`连接配置删除失败：${extractErrorMessage(error)}`)
    }
  }

  async function toggleAccountStatus(account: MaxKbAccount) {
    try {
      const nextStatus = account.status === 1 ? 0 : 1
      const updated = await updateKnowledgeAccountStatus(account.id, nextStatus)
      message.success(nextStatus === 1 ? '连接已启用' : '连接已停用')
      if (accountForm.id === account.id) {
        editAccount(updated)
      }
      void loadAccounts(selectedAccountId, true)
    } catch (error) {
      message.error(`状态更新失败：${extractErrorMessage(error)}`)
    }
  }

  async function testAccount(accountId: number) {
    setTestingAccountId(accountId)
    try {
      await testKnowledgeAccount(accountId)
      message.success('连接测试通过')
    } catch (error) {
      message.error(`连接测试失败：${extractErrorMessage(error)}`)
    } finally {
      setTestingAccountId(undefined)
    }
  }

  const loadDocuments = useCallback(async (knowledgeId: string) => {
    const requestSeq = ++documentsRequestSeq.current
    setSelectedDocumentId('')
    setDocuments([])
    setParagraphs([])
    setDocumentTotal(0)
    setParagraphTotal(0)
    if (!selectedAccountId || !knowledgeId) {
      return
    }

    setLoadingDocuments(true)
    try {
      const payload = await getKnowledgeDocuments(selectedAccountId, knowledgeId, { current_page: 1, page_size: 100, task_type: 1 })
      if (requestSeq !== documentsRequestSeq.current) {
        return
      }
      const rows = makeRows(extractRecords(payload), 'document') as DocumentRow[]
      setDocuments(rows)
      setDocumentTotal(extractTotal(payload, rows.length))
    } catch (error) {
      if (requestSeq !== documentsRequestSeq.current) {
        return
      }
      setDocuments([])
      setDocumentTotal(0)
      notify('error', `文档列表加载失败：${extractErrorMessage(error)}`)
    } finally {
      if (requestSeq === documentsRequestSeq.current) {
        setLoadingDocuments(false)
      }
    }
  }, [selectedAccountId])

  const loadParagraphs = useCallback(async (knowledgeId: string, documentId: string) => {
    if (!selectedAccountId || !knowledgeId || !documentId) {
      return
    }

    setLoadingParagraphs(true)
    try {
      const payload = await getDocumentParagraphs(selectedAccountId, knowledgeId, documentId, { page: 1, size: 100 })
      const rows = makeRows(extractRecords(payload), 'paragraph') as ParagraphRow[]
      setParagraphs(rows)
      setParagraphTotal(extractTotal(payload, rows.length))
    } catch (error) {
      setParagraphs([])
      setParagraphTotal(0)
      notify('error', `段落加载失败：${extractErrorMessage(error)}`)
    } finally {
      setLoadingParagraphs(false)
    }
  }, [selectedAccountId])

  async function openParagraphEditor(paragraph: ParagraphRow) {
    setEditingParagraph(paragraph)
    setEditTitle(paragraph.nameText === paragraph.idText ? '' : paragraph.nameText)
    setEditContent(paragraph.contentText)
    setEditProblems(recordProblemList(paragraph))
    setNewProblemText('')
    setProblemInputVisible(false)

    if (!selectedAccountId || !selectedKnowledgeId || !selectedDocumentId || !paragraph.idText) {
      return
    }

    setLoadingParagraphProblems(true)
    try {
      const payload = await getDocumentParagraphProblems(selectedAccountId, selectedKnowledgeId, selectedDocumentId, paragraph.idText)
      const remoteProblems = normalizeProblemList(extractRecords(payload))
      if (remoteProblems.length > 0) {
        setEditProblems(remoteProblems)
      }
    } catch {
      // Some MaxKB OpenAPI keys can edit content but cannot read related questions.
    } finally {
      setLoadingParagraphProblems(false)
    }
  }

  function closeParagraphEditor(force = false) {
    if (savingParagraph && !force) {
      return
    }
    setEditingParagraph(null)
    setEditTitle('')
    setEditContent('')
    setEditProblems([])
    setNewProblemText('')
    setProblemInputVisible(false)
  }

  function addProblem() {
    const content = newProblemText.trim()
    if (!content) {
      return
    }
    if (editProblems.some((item) => item.content === content)) {
      message.info('这个问题已经关联过了')
      setNewProblemText('')
      return
    }
    setEditProblems((items) => [...items, { content }])
    setNewProblemText('')
    setProblemInputVisible(false)
  }

  function removeProblem(index: number) {
    setEditProblems((items) => items.filter((_, itemIndex) => itemIndex !== index))
  }

  function wrapEditSelection(prefix: string, suffix = '', placeholder = '文本') {
    const textarea = editContentInputRef.current?.resizableTextArea?.textArea
    const start = textarea?.selectionStart ?? editContent.length
    const end = textarea?.selectionEnd ?? editContent.length
    const selectedText = editContent.slice(start, end) || placeholder
    const nextContent = `${editContent.slice(0, start)}${prefix}${selectedText}${suffix}${editContent.slice(end)}`
    setEditContent(nextContent.slice(0, 100000))
    window.requestAnimationFrame(() => {
      textarea?.focus()
      if (textarea) {
        textarea.selectionStart = start + prefix.length
        textarea.selectionEnd = start + prefix.length + selectedText.length
      }
    })
  }

  function insertEditSnippet(snippet: string) {
    const textarea = editContentInputRef.current?.resizableTextArea?.textArea
    const start = textarea?.selectionStart ?? editContent.length
    const nextContent = `${editContent.slice(0, start)}${snippet}${editContent.slice(start)}`
    setEditContent(nextContent.slice(0, 100000))
    window.requestAnimationFrame(() => textarea?.focus())
  }

  async function saveParagraphEditor() {
    if (!editingParagraph || !selectedAccountId || !selectedKnowledgeId || !selectedDocumentId) {
      return
    }
    const content = editContent.trim()
    if (!content) {
      message.warning('请输入分段内容')
      return
    }

    const title = editTitle.trim()
    const problemList = editProblems.map((item) => (item.id ? { id: item.id, content: item.content } : { content: item.content }))
    setSavingParagraph(true)
    try {
      await updateDocumentParagraph(selectedAccountId, selectedKnowledgeId, selectedDocumentId, editingParagraph.idText, {
        title,
        content: editContent,
        is_active: true,
        problem_list: problemList,
      })
      setParagraphs((items) =>
        items.map((item) =>
          item.key === editingParagraph.key
            ? {
                ...item,
                title,
                nameText: title || item.nameText,
                content: editContent,
                contentText: editContent,
                problem_list: problemList,
              }
            : item,
        ),
      )
      message.success('分段已保存')
      closeParagraphEditor(true)
      void loadParagraphs(selectedKnowledgeId, selectedDocumentId)
    } catch (error) {
      message.error(`分段保存失败：${extractErrorMessage(error)}`)
    } finally {
      setSavingParagraph(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time remote option loading owns its request state
    void loadAccountEnvironments()
    void loadAccounts(undefined, true)
  }, [loadAccountEnvironments, loadAccounts])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- account selection intentionally clears stale remote browser state
    resetBrowserState()
    if (selectedAccountId) {
      void loadKnowledges()
    }
  }, [loadKnowledges, selectedAccountId])

  useEffect(() => {
    if (selectedKnowledgeId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- knowledge selection intentionally loads remote documents into local request state
      void loadDocuments(selectedKnowledgeId)
    }
  }, [loadDocuments, selectedKnowledgeId])

  useEffect(() => {
    if (selectedKnowledgeId && selectedDocumentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- document selection intentionally loads remote paragraphs into local request state
      void loadParagraphs(selectedKnowledgeId, selectedDocumentId)
    }
  }, [loadParagraphs, selectedDocumentId, selectedKnowledgeId])

  function openKnowledge(record: KnowledgeRow) {
    setSelectedKnowledgeId(record.idText)
    setSelectedDocumentId('')
    setParagraphs([])
    setParagraphTotal(0)
    setView('documents')
  }

  function openDocument(record: DocumentRow) {
    setSelectedDocumentId(record.idText)
    setView('paragraphs')
  }

  function backToRoot() {
    setView('knowledge')
    setSelectedKnowledgeId('')
    setSelectedDocumentId('')
    setDocuments([])
    setParagraphs([])
    setDocumentTotal(0)
    setParagraphTotal(0)
  }

  function backToDocuments() {
    setView('documents')
    setSelectedDocumentId('')
    setParagraphs([])
    setParagraphTotal(0)
  }

  function openUploadWorkbench() {
    if (!selectedAccountId || !selectedKnowledgeId) {
      message.warning('请先选择一个 MaxKB 连接和知识库')
      return
    }
    setView('upload')
  }

  function notifyReadOnlyAction() {
    notify('info', '当前页面对接 MaxKB OpenAPI，以浏览和检索展示为主。')
  }

  function scrollToParagraph(id: string) {
    document.getElementById(`paragraph-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const documentColumns: TableColumnsType<DocumentRow> = useMemo(() => [
    {
      title: '文件名称',
      dataIndex: 'nameText',
      width: 320,
      ellipsis: true,
      render: (value, record) => (
        <button className="mkb-table-link" type="button" onClick={() => openDocument(record)}>
          {String(value ?? '-')}
        </button>
      ),
    },
    {
      title: '文件状态',
      width: 120,
      render: (_, record) => {
        const status = statusOf(record)
        return (
          <span className="mkb-status">
            {status.color === 'success' ? <CheckCircleFilled /> : null}
            <span>{status.text}</span>
          </span>
        )
      },
    },
    {
      title: '字符数',
      align: 'right',
      width: 130,
      render: (_, record) => numberText(record.char_length ?? record.character_count ?? record.word_count),
      sorter: (left, right) =>
        Number(left.char_length ?? left.character_count ?? 0) - Number(right.char_length ?? right.character_count ?? 0),
    },
    {
      title: '分段',
      align: 'right',
      width: 120,
      render: (_, record) => numberText(record.paragraph_count ?? record.segment_count ?? record.chunk_count),
      sorter: (left, right) =>
        Number(left.paragraph_count ?? left.segment_count ?? 0) - Number(right.paragraph_count ?? right.segment_count ?? 0),
    },
    {
      title: '启用状态',
      width: 115,
      render: (_, record) => (
        <span className="mkb-status">
          <CheckCircleFilled />
          <span>{enabledOf(record) ? '已启用' : '已停用'}</span>
        </span>
      ),
    },
    {
      title: '标签',
      width: 130,
      render: (_, record) => {
        const tagCount = Number(record.tag_count ?? 0)
        return tagCount > 0 ? <Tag>{tagCount} 标签</Tag> : <Button size="small">+ 标签</Button>
      },
    },
    { title: '命中处理方式', width: 150, render: () => '模型优化' },
    { title: '创建者', width: 130, render: (_, record) => textOf(record, ['create_user', 'creator'], '系统管理员') },
    {
      title: '创建时间',
      width: 170,
      render: (_, record) => dateText(record, ['create_time', 'created_at', 'created_time']),
      sorter: (left, right) => String(left.create_time ?? '').localeCompare(String(right.create_time ?? '')),
    },
    {
      title: '更新时间',
      width: 170,
      render: (_, record) => dateText(record, ['update_time', 'updated_at', 'updated_time']),
      sorter: (left, right) => String(left.update_time ?? '').localeCompare(String(right.update_time ?? '')),
    },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size={8}>
          <Button size="small" type="link" onClick={() => openDocument(record)}>分段</Button>
          <Button size="small" type="link" icon={<MoreOutlined />} onClick={() => setDetailRecord(record)} />
        </Space>
      ),
    },
  ], [])

  return (
    <div className="mkb-knowledge-page">
      <aside className="mkb-knowledge-sidebar">
        <div className="mkb-sidebar-title">知识库</div>
        <Select
          size="small"
          placeholder="选择连接"
          value={selectedAccountId}
          loading={loadingAccounts}
          options={accounts.map((account) => ({
            value: account.id,
            label: account.accountName,
            disabled: account.status !== 1,
          }))}
          onChange={selectAccount}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <div className="mkb-sidebar-search">
          <Input
            allowClear
            size="small"
            prefix={<SearchOutlined />}
            placeholder="搜索"
            value={knowledgeSearch}
            onChange={(event) => setKnowledgeSearch(event.target.value)}
          />
          <Button size="small" icon={<BranchesOutlined />} />
        </div>
        <button
          type="button"
          className={view === 'knowledge' ? 'mkb-folder-item is-active' : 'mkb-folder-item'}
          onClick={backToRoot}
        >
          <FolderFilled />
          <span>根目录</span>
        </button>
        <button className="mkb-config-entry" type="button" onClick={openConfigDrawer}>
          <SettingOutlined />
          <span>连接配置</span>
        </button>
        <button className="mkb-sidebar-collapse" type="button" aria-label="收起侧边栏">‹</button>
      </aside>

      <main className="mkb-knowledge-main">
        {notice ? (
          <Alert
            className="mkb-notice"
            type={notice.type}
            message={notice.text}
            showIcon
            closable
            onClose={() => setNotice(null)}
          />
        ) : null}

        {view === 'knowledge' ? (
          <section className="mkb-view mkb-view--knowledge">
            <header className="mkb-view-header">
              <h1>{selectedAccount?.accountName ?? '根目录'} <span className="mkb-title-count">{knowledgeTotal}</span></h1>
              <div className="mkb-toolbar">
                <Select
                  size="small"
                  placeholder="连接"
                  value={selectedAccountId}
                  loading={loadingAccounts}
                  style={{ width: 150 }}
                  options={accounts.map((account) => ({
                    value: account.id,
                    label: account.accountName,
                    disabled: account.status !== 1,
                  }))}
                  onChange={selectAccount}
                />
                <Select
                  size="small"
                  value="name"
                  style={{ width: 92 }}
                  options={[{ value: 'name', label: '名称' }]}
                />
                <Input
                  allowClear
                  size="small"
                  prefix={<SearchOutlined />}
                  placeholder="按名称搜索"
                  value={knowledgeSearch}
                  onChange={(event) => setKnowledgeSearch(event.target.value)}
                  style={{ width: 190 }}
                />
                <Button size="small" icon={<BranchesOutlined />} onClick={notifyReadOnlyAction}>批量选择</Button>
                <Button size="small" icon={<SettingOutlined />} onClick={openConfigDrawer}>连接配置</Button>
                <Button size="small" type="primary" onClick={notifyReadOnlyAction}>
                  创建
                </Button>
                <Button size="small" icon={<ReloadOutlined />} loading={loadingKnowledges} onClick={() => void loadKnowledges()} />
              </div>
            </header>
            {!selectedAccountId ? (
              <Empty description="请先新增或选择一个 MaxKB 连接配置" />
            ) : null}
            <div className="mkb-knowledge-grid">
              {filteredKnowledges.map((knowledge) => (
                <button
                  key={knowledge.key}
                  type="button"
                  className="mkb-knowledge-card"
                  onClick={() => openKnowledge(knowledge)}
                >
                  <div className="mkb-knowledge-card__head">
                    <span className="mkb-knowledge-icon"><BookOutlined /></span>
                    <span>
                      <strong>{knowledge.nameText}</strong>
                      <small>{textOf(knowledge, ['create_user', 'creator'], '系统管理员')} 创建于 {dateText(knowledge, ['create_time', 'created_at', 'created_time'])}</small>
                    </span>
                  </div>
                  <p>{shortText(knowledge.desc ?? knowledge.description ?? knowledge.contentText, 88)}</p>
                  <div className="mkb-knowledge-card__meta">
                    <span>{numberText(knowledge.document_count ?? knowledge.document_num ?? documentTotal, '0')} 文档数</span>
                    <span>{numberText(knowledge.char_length ?? knowledge.character_count, '0')} 字符</span>
                    <MoreOutlined />
                  </div>
                </button>
              ))}
              {!loadingKnowledges && filteredKnowledges.length === 0 ? <Empty description="暂无知识库" /> : null}
            </div>
          </section>
        ) : null}

        {view === 'documents' ? (
          <section className="mkb-view mkb-view--documents">
            <header className="mkb-document-title">
              <h1>{selectedKnowledge?.nameText ?? '文档'}</h1>
              <div className="mkb-toolbar">
                <Button size="small" type="primary" icon={<CloudUploadOutlined />} onClick={openUploadWorkbench}>上传文档</Button>
                <Button size="small" disabled icon={<BranchesOutlined />}>向量化</Button>
                <Button size="small" disabled>分词索引</Button>
                <Button size="small" disabled>生成问题</Button>
                <Button size="small" icon={<MoreOutlined />} />
                <Select
                  size="small"
                  value={documentSearchType}
                  style={{ width: 92 }}
                  onChange={setDocumentSearchType}
                  options={[
                    { value: 'name', label: '名称' },
                    { value: 'creator', label: '创建者' },
                  ]}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="按名称搜索"
                  value={documentSearch}
                  onChange={(event) => setDocumentSearch(event.target.value)}
                  style={{ width: 190 }}
                />
                <Button size="small" icon={<TagsOutlined />} onClick={notifyReadOnlyAction}>标签管理</Button>
                <Button size="small" icon={<ReloadOutlined />} loading={loadingDocuments} onClick={() => void loadDocuments(selectedKnowledgeId)} />
              </div>
            </header>
            <div className="mkb-document-shell">
              <Table
                rowKey="key"
                rowSelection={{}}
                columns={documentColumns}
                dataSource={filteredDocuments}
                loading={loadingDocuments}
                pagination={{
                  pageSize: 10,
                  size: 'small',
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                size="small"
                scroll={{ x: 1550 }}
                className="mkb-document-table"
                onRow={(record) => ({
                  onDoubleClick: () => openDocument(record),
                })}
              />
            </div>
          </section>
        ) : null}

        {view === 'upload' && selectedAccountId && selectedKnowledgeId ? (
          <section className="mkb-view mkb-view--upload">
            <MaxKbDocumentUploadWorkbench
              accountId={selectedAccountId}
              knowledgeId={selectedKnowledgeId}
              knowledgeName={selectedKnowledge?.nameText ?? '知识库'}
              onCancel={() => setView('documents')}
              onImported={() => {
                void loadDocuments(selectedKnowledgeId)
                setView('documents')
              }}
            />
          </section>
        ) : null}

        {view === 'paragraphs' ? (
          <section className="mkb-view mkb-view--paragraphs">
            <header className="mkb-paragraph-topbar">
              <div className="mkb-paragraph-title">
                <Button type="text" size="small" icon={<ArrowLeftOutlined />} onClick={backToDocuments} />
                <h1>{selectedDocument?.nameText ?? '文档分段'}</h1>
              </div>
              <div className="mkb-toolbar">
                <Button size="small" onClick={notifyReadOnlyAction}>批量选择</Button>
                <Button size="small" type="primary" icon={<FileAddOutlined />} onClick={notifyReadOnlyAction}>添加分段</Button>
              </div>
            </header>
            <div className="mkb-paragraph-shell">
              <aside className="mkb-paragraph-anchor">
                <strong>{paragraphTotal} 段落</strong>
                {filteredParagraphs.map((paragraph, index) => (
                  <button
                    key={paragraph.key}
                    type="button"
                    onClick={() => scrollToParagraph(paragraph.idText)}
                  >
                    {paragraph.nameText || `段落 ${index + 1}`}
                  </button>
                ))}
              </aside>
              <div className="mkb-paragraph-content">
                <div className="mkb-paragraph-filter">
                  <Select
                    size="small"
                    value={paragraphSearchType}
                    style={{ width: 82 }}
                    onChange={setParagraphSearchType}
                    options={[
                      { value: 'title', label: '标题' },
                      { value: 'content', label: '内容' },
                    ]}
                  />
                  <Input
                    allowClear
                    size="small"
                    placeholder="搜索"
                    value={paragraphSearch}
                    onChange={(event) => setParagraphSearch(event.target.value)}
                    style={{ width: 210 }}
                  />
                </div>
                {loadingParagraphs ? <Empty description="正在加载段落..." /> : null}
                {!loadingParagraphs && filteredParagraphs.length === 0 ? <Empty description="暂无段落" /> : null}
                {filteredParagraphs.map((paragraph, index) => (
                  <article id={`paragraph-${paragraph.idText}`} key={paragraph.key} className="mkb-paragraph-card">
                    <div className="mkb-paragraph-card__index">{index + 1}</div>
                    <div className="mkb-paragraph-card__body">
                      <h2>{paragraph.nameText || `段落 ${index + 1}`}</h2>
                      <RichDocumentContent accountId={selectedAccountId} assetBaseUrl={assetBaseUrl} record={paragraph} />
                      <div className="mkb-paragraph-card__meta">
                        <span>{numberText(paragraph.contentText.length, '0')} 字符</span>
                        <Space size={4}>
                          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => void openParagraphEditor(paragraph)}>编辑</Button>
                          <Button size="small" type="link" icon={<MoreOutlined />} onClick={() => setDetailRecord(paragraph)} />
                        </Space>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <Modal
        title="编辑分段"
        open={Boolean(editingParagraph)}
        width="94vw"
        centered
        className="mkb-paragraph-edit-modal"
        maskClosable={false}
        onCancel={() => closeParagraphEditor()}
        footer={[
          <Button key="cancel" onClick={() => closeParagraphEditor()} disabled={savingParagraph}>
            取消
          </Button>,
          <Button key="save" type="primary" loading={savingParagraph} onClick={() => void saveParagraphEditor()}>
            保存
          </Button>,
        ]}
      >
        <div className="mkb-edit-dialog">
          <section className="mkb-edit-main">
            <label className="mkb-edit-label" htmlFor="paragraph-title">分段标题</label>
            <Input
              id="paragraph-title"
              maxLength={256}
              showCount
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              placeholder="请输入分段标题"
            />

            <label className="mkb-edit-label mkb-edit-label--required" htmlFor="paragraph-content">分段内容</label>
            <div className="mkb-editor-shell">
              <div className="mkb-editor-toolbar">
                <Button size="small" type="text" title="加粗" icon={<BoldOutlined />} onClick={() => wrapEditSelection('**', '**', '加粗文本')} />
                <Button size="small" type="text" title="下划线" icon={<UnderlineOutlined />} onClick={() => wrapEditSelection('<u>', '</u>', '下划线文本')} />
                <Button size="small" type="text" title="斜体" icon={<ItalicOutlined />} onClick={() => wrapEditSelection('*', '*', '斜体文本')} />
                <span className="mkb-toolbar-separator" />
                <Button size="small" type="text" title="标题" icon={<span className="mkb-toolbar-text-icon">H</span>} onClick={() => insertEditSnippet('\n## 标题\n')} />
                <Button size="small" type="text" title="删除线" icon={<StrikethroughOutlined />} onClick={() => wrapEditSelection('~~', '~~', '删除线文本')} />
                <Button size="small" type="text" title="无序列表" icon={<UnorderedListOutlined />} onClick={() => insertEditSnippet('\n- 列表项\n')} />
                <Button size="small" type="text" title="有序列表" icon={<OrderedListOutlined />} onClick={() => insertEditSnippet('\n1. 列表项\n')} />
                <Button size="small" type="text" title="代码" icon={<CodeOutlined />} onClick={() => wrapEditSelection('`', '`', 'code')} />
                <Button size="small" type="text" title="链接" icon={<LinkOutlined />} onClick={() => insertEditSnippet('[链接文字](https://example.com)')} />
                <Button size="small" type="text" title="图片" icon={<PictureOutlined />} onClick={() => insertEditSnippet('![图片说明](图片地址)')} />
                <Button size="small" type="text" title="表格" icon={<TableOutlined />} onClick={() => insertEditSnippet('\n| 表头 | 表头 |\n| --- | --- |\n| 内容 | 内容 |\n')} />
                <span className="mkb-toolbar-separator" />
                <Button size="small" type="text" title="撤销" icon={<UndoOutlined />} onClick={() => document.execCommand('undo')} />
                <Button size="small" type="text" title="重做" icon={<RedoOutlined />} onClick={() => document.execCommand('redo')} />
                <span className="mkb-toolbar-spacer" />
                <Button size="small" type="text" title="全屏" icon={<FullscreenOutlined />} onClick={() => message.info('当前弹窗已使用大尺寸编辑区域')} />
                <Button size="small" type="text" title="预览" icon={<EyeOutlined />} onClick={() => message.info('保存后会在文档区按当前格式预览')} />
              </div>
              <Input.TextArea
                id="paragraph-content"
                ref={editContentInputRef}
                value={editContent}
                maxLength={100000}
                onChange={(event) => setEditContent(event.target.value)}
                placeholder="请输入分段内容，支持 Markdown 表格、标题和图片语法"
                className="mkb-editor-textarea"
              />
              <div className="mkb-editor-footer">
                <span>字数：{editContent.length} / 100000</span>
              </div>
            </div>
          </section>

          <aside className="mkb-edit-side">
            <div className="mkb-edit-side__title">
              <span>关联问题</span>
              <span className="mkb-edit-side__divider" />
              <Button
                size="small"
                type="text"
                icon={<PlusOutlined />}
                onClick={() => setProblemInputVisible(true)}
              />
            </div>
            <div className="mkb-edit-side__body">
              {problemInputVisible ? (
                <Input
                  autoFocus
                  value={newProblemText}
                  placeholder="输入问题后回车"
                  disabled={loadingParagraphProblems}
                  onChange={(event) => setNewProblemText(event.target.value)}
                  onPressEnter={addProblem}
                  onBlur={() => {
                    if (!newProblemText.trim()) {
                      setProblemInputVisible(false)
                    }
                  }}
                />
              ) : null}
              {loadingParagraphProblems ? <Text type="secondary">正在读取关联问题...</Text> : null}
              <div className="mkb-problem-tags">
                {editProblems.map((item, index) => (
                  <Tag
                    key={`${item.id ?? item.content}-${index}`}
                    closable
                    closeIcon={<DeleteOutlined />}
                    onClose={(event) => {
                      event.preventDefault()
                      removeProblem(index)
                    }}
                  >
                    {item.content}
                  </Tag>
                ))}
                {!loadingParagraphProblems && editProblems.length === 0 ? (
                  <Text type="secondary">暂无关联问题</Text>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </Modal>

      <Drawer
        title="知识库连接配置"
        rootClassName="mkb-config-drawer-root"
        width={880}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        extra={
          <Space>
            <Button size="small" icon={<PlusOutlined />} onClick={createAccountDraft}>新增连接</Button>
            <Button size="small" icon={<ReloadOutlined />} loading={loadingAccounts} onClick={() => void loadAccounts()}>刷新</Button>
          </Space>
        }
        footer={
          <div className="mkb-config-footer">
            <Button onClick={() => setConfigOpen(false)}>取消</Button>
            <Button type="primary" loading={savingAccount} onClick={() => void saveAccount()}>
              {accountForm.id ? '保存连接' : '新增连接'}
            </Button>
          </div>
        }
      >
        <div className="mkb-config-drawer">
          <Alert
            type={selectedAccount ? 'success' : 'warning'}
            showIcon
            message={selectedAccount ? `当前正在浏览：${selectedAccount.accountName}` : '请新增或选择一个 MaxKB 连接配置'}
          />

          <Table<MaxKbAccount>
            rowKey="id"
            size="small"
            loading={loadingAccounts}
            dataSource={accounts}
            pagination={false}
            columns={[
              {
                title: '连接名称',
                dataIndex: 'accountName',
                width: 160,
                render: (value, account) => (
                  <button className="mkb-table-link" type="button" onClick={() => selectAccount(account.id)}>
                    {String(value ?? '-')}
                  </button>
                ),
              },
              { title: '环境', dataIndex: 'environmentText', width: 90, render: (value, account) => value || account.environment },
              { title: '地址', dataIndex: 'baseUrl', ellipsis: true },
              { title: '工作空间', dataIndex: 'workspaceId', width: 120, ellipsis: true },
              {
                title: 'Key',
                width: 130,
                render: (_, account) => account.apiKeyConfigured ? <Tag color="success">{account.apiKeyMasked || '已配置'}</Tag> : <Tag color="warning">未配置</Tag>,
              },
              {
                title: '管理端',
                width: 130,
                render: (_, account) => account.managementTokenConfigured ? <Tag color="processing">{account.managementTokenMasked || '已配置'}</Tag> : <Tag color="warning">未配置</Tag>,
              },
              {
                title: '状态',
                width: 90,
                render: (_, account) => <Tag color={account.status === 1 ? 'success' : 'default'}>{account.statusText || (account.status === 1 ? '启用' : '停用')}</Tag>,
              },
              {
                title: '操作',
                width: 240,
                fixed: 'right',
                render: (_, account) => (
                  <Space size={4}>
                    <Button size="small" type="link" onClick={() => editAccount(account)}>编辑</Button>
                    <Button size="small" type="link" onClick={() => selectAccount(account.id)}>使用</Button>
                    <Button
                      size="small"
                      type="link"
                      loading={testingAccountId === account.id}
                      onClick={() => void testAccount(account.id)}
                    >
                      测试
                    </Button>
                    <Button size="small" type="link" onClick={() => void toggleAccountStatus(account)}>
                      {account.status === 1 ? '停用' : '启用'}
                    </Button>
                    <Popconfirm
                      title="删除连接配置"
                      description="删除后无法在此页面继续使用该 MaxKB 连接。"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => void removeAccount(account.id)}
                    >
                      <Button size="small" danger type="link">删除</Button>
                    </Popconfirm>
                  </Space>
                ),
              },
            ]}
            scroll={{ x: 820 }}
            locale={{ emptyText: '暂无连接配置' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <Text strong>{accountForm.id ? '编辑连接' : '新增连接'}</Text>
            <Text type="secondary">共 {accountTotal} 条连接</Text>
          </div>

          <label>
            <span>连接名称</span>
            <Input
              value={accountForm.accountName}
              placeholder="例如：本地 MaxKB / 生产 MaxKB"
              onChange={(event) => updateAccountField('accountName', event.target.value)}
            />
          </label>

          <label>
            <span>MaxKB 管理端地址</span>
            <Input
              value={accountForm.baseUrl}
              placeholder="http://localhost:3000"
              onChange={(event) => updateAccountField('baseUrl', event.target.value)}
            />
          </label>

          <label>
            <span>工作空间 ID</span>
            <Input
              value={accountForm.workspaceId}
              placeholder="default"
              onChange={(event) => updateAccountField('workspaceId', event.target.value)}
            />
          </label>

          <label>
            <span>环境</span>
            <Select
              value={accountForm.environment}
              options={(accountEnvironments.length ? accountEnvironments : [
                { value: 'local', label: '本地' },
                { value: 'test', label: '测试' },
                { value: 'prod', label: '线上' },
                { value: 'custom', label: '自定义' },
              ]).map((item) => ({ value: item.value, label: item.label }))}
              onChange={(value) => updateAccountField('environment', value)}
            />
          </label>

          <label>
            <span>OpenAPI Key</span>
            <Input.Password
              value={accountForm.apiKey}
              placeholder={accountForm.id ? '留空表示沿用已保存 Key' : '请输入 MaxKB OpenAPI Key'}
              onChange={(event) => updateAccountField('apiKey', event.target.value)}
            />
          </label>

          <label>
            <span>管理端 Token</span>
            <Input.Password
              value={accountForm.managementToken}
              placeholder={accountForm.id ? '留空表示沿用已保存 Token' : '用于编辑、问题和上传回退'}
              onChange={(event) => updateAccountField('managementToken', event.target.value)}
            />
          </label>

          <label>
            <span>备注</span>
            <Input
              value={accountForm.remark}
              placeholder="用途、负责人或访问范围"
              onChange={(event) => updateAccountField('remark', event.target.value)}
            />
          </label>

          <label>
            <span>状态</span>
            <Select
              value={accountForm.status}
              options={[
                { value: 1, label: '启用' },
                { value: 0, label: '停用' },
              ]}
              onChange={(value) => updateAccountField('status', value)}
            />
          </label>

          <div className="mkb-config-sync">
            <Text strong>同步 OpenAPI Key</Text>
            <Button loading={syncingKeys} onClick={() => void syncKeys()}>同步 Key</Button>
          </div>

          {syncedKeys.length > 0 ? (
            <label>
              <span>选择已同步 Key</span>
              <Select
                placeholder="选择后自动填入 OpenAPI Key"
                onChange={selectSyncedKey}
                options={syncedKeys.map((item, index) => ({
                  value: String(item.id ?? item.name ?? item.secret_key ?? index),
                  label: item.name || item.id || `OpenAPI Key ${index + 1}`,
                }))}
              />
            </label>
          ) : null}
        </div>
      </Drawer>

      <Drawer title="原始数据" width={720} open={Boolean(detailRecord)} onClose={() => setDetailRecord(null)}>
        {detailRecord ? (
          <div className="mkb-raw-data">
            {Object.entries(detailRecord).map(([key, value]) => (
              <div key={key}>
                <Text type="secondary">{key}</Text>
                <Paragraph copyable style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                </Paragraph>
              </div>
            ))}
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
