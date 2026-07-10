import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
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
  StrikethroughOutlined,
  TagsOutlined,
  TableOutlined,
  UnderlineOutlined,
  UndoOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import {
  extractRecords,
  extractTotal,
  getDocumentParagraphs,
  getDocumentParagraphProblems,
  getKnowledgeDocuments,
  getKnowledgeOpenApiConfig,
  getKnowledges,
  updateDocumentParagraph,
  type MaxKbRecord,
  type ParagraphProblemPayload,
} from '../api/knowledgeOpenApi'

type BrowserView = 'knowledge' | 'documents' | 'paragraphs'
type KnowledgeRow = MaxKbRecord & { key: string; idText: string; nameText: string; contentText: string }
type DocumentRow = MaxKbRecord & { key: string; idText: string; nameText: string; contentText: string }
type ParagraphRow = MaxKbRecord & { key: string; idText: string; nameText: string; contentText: string }
type NoticeState = { type: 'success' | 'info' | 'warning' | 'error'; text: string } | null

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

function normalizeResourceUrl(rawUrl: string, assetBaseUrl: string) {
  const trimmed = rawUrl.trim()
  if (!trimmed || /^javascript:/i.test(trimmed)) {
    return ''
  }
  if (/^(data:image\/|blob:|https?:\/\/|\/\/)/i.test(trimmed)) {
    return trimmed
  }
  if (!assetBaseUrl) {
    return trimmed
  }
  try {
    return new URL(trimmed, `${assetBaseUrl.replace(/\/$/, '')}/`).toString()
  } catch {
    return trimmed
  }
}

function sanitizeHtml(value: string, assetBaseUrl: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|form|input|button|meta|link|base)[^>]*>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\son\w+=\S+/gi, '')
    .replace(/\s(src|href)=("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (_match, attr: string, _quoted: string, doubleUrl?: string, singleUrl?: string, bareUrl?: string) => {
      const url = normalizeResourceUrl(doubleUrl ?? singleUrl ?? bareUrl ?? '', assetBaseUrl)
      return url ? ` ${attr.toLowerCase()}="${escapeHtml(url)}"` : ''
    })
}

function renderInlineMarkdown(value: string, assetBaseUrl: string) {
  const chunks: string[] = []
  const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = imagePattern.exec(value)) !== null) {
    chunks.push(escapeHtml(value.slice(lastIndex, match.index)))
    const src = normalizeResourceUrl(match[2], assetBaseUrl)
    if (src) {
      chunks.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(match[1])}" loading="lazy" />`)
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

function renderMarkdownTable(lines: string[], assetBaseUrl: string) {
  const [headerLine, , ...bodyLines] = lines
  const headers = splitTableRow(headerLine)
  const bodyRows = bodyLines.map(splitTableRow)
  return [
    '<table>',
    '<thead><tr>',
    ...headers.map((header) => `<th>${renderInlineMarkdown(header, assetBaseUrl)}</th>`),
    '</tr></thead>',
    '<tbody>',
    ...bodyRows.map((row) => `<tr>${headers.map((_header, index) => `<td>${renderInlineMarkdown(row[index] ?? '', assetBaseUrl)}</td>`).join('')}</tr>`),
    '</tbody>',
    '</table>',
  ].join('')
}

function markdownToHtml(markdown: string, assetBaseUrl: string) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const blocks: string[] = []
  let paragraphLines: string[] = []
  let index = 0

  const flushParagraph = () => {
    if (!paragraphLines.length) {
      return
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join('\n'), assetBaseUrl).replace(/\n/g, '<br />')}</p>`)
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
      blocks.push(renderMarkdownTable(tableLines, assetBaseUrl))
      continue
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed)
    if (heading) {
      flushParagraph()
      const level = Math.min(heading[1].length + 1, 5)
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2], assetBaseUrl)}</h${level}>`)
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
        items.push(`<li>${renderInlineMarkdown(currentMatch[1], assetBaseUrl)}</li>`)
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

function richContentHtml(rawContent: string, assetBaseUrl: string) {
  const raw = rawContent.trim()
  if (!raw) {
    return ''
  }
  if (/<(?:table|thead|tbody|tr|td|th|img|h[1-6]|p|ul|ol|li|br|strong|em|div|span)\b/i.test(raw)) {
    return sanitizeHtml(raw, assetBaseUrl)
  }
  return markdownToHtml(raw, assetBaseUrl)
}

function looksLikeImageUrl(value: string) {
  return /^(?:data:image\/|blob:|https?:\/\/|\/\/|\/|\.{1,2}\/).+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#].*)?$/i.test(value.trim())
}

function collectImageUrls(value: unknown, assetBaseUrl: string, urls = new Set<string>(), depth = 0) {
  if (value == null || depth > 4) {
    return urls
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, assetBaseUrl, urls, depth + 1))
    return urls
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectImageUrls(item, assetBaseUrl, urls, depth + 1))
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
      collectImageUrls(JSON.parse(trimmed), assetBaseUrl, urls, depth + 1)
    } catch {
      // Ignore non-JSON strings.
    }
  }

  const htmlImagePattern = /<img[^>]+src=["']([^"']+)["']/gi
  const markdownImagePattern = /!\[[^\]]*]\(([^)]+)\)/g
  const imageUrlPattern = /(?:data:image\/[^"'\s<>)]*|(?:https?:)?\/\/[^"'\s<>)]*|(?:\/|\.{1,2}\/)[^"'\s<>)]*)\.(?:png|jpe?g|gif|webp|svg|bmp)(?:[?#][^"'\s<>)]*)?/gi
  let match: RegExpExecArray | null

  while ((match = htmlImagePattern.exec(trimmed)) !== null) {
    const url = normalizeResourceUrl(match[1], assetBaseUrl)
    if (url) urls.add(url)
  }
  while ((match = markdownImagePattern.exec(trimmed)) !== null) {
    const url = normalizeResourceUrl(match[1], assetBaseUrl)
    if (url) urls.add(url)
  }
  while ((match = imageUrlPattern.exec(trimmed)) !== null) {
    const url = normalizeResourceUrl(match[0], assetBaseUrl)
    if (url) urls.add(url)
  }

  if (looksLikeImageUrl(trimmed)) {
    const url = normalizeResourceUrl(trimmed, assetBaseUrl)
    if (url) urls.add(url)
  }

  return urls
}

function extractRecordImages(record: MaxKbRecord, assetBaseUrl: string) {
  const imageKeys = ['image', 'images', 'img', 'imgs', 'picture', 'pictures', 'screenshot', 'screenshots', 'thumbnail', 'preview', 'media', 'metadata', 'meta']
  const urls = new Set<string>()

  Object.entries(record).forEach(([key, value]) => {
    const normalizedKey = key.toLowerCase()
    if (imageKeys.some((imageKey) => normalizedKey.includes(imageKey))) {
      collectImageUrls(value, assetBaseUrl, urls)
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

function RichDocumentContent({ assetBaseUrl, record }: { assetBaseUrl: string; record: ParagraphRow }) {
  const html = useMemo(() => richContentHtml(record.contentText, assetBaseUrl), [assetBaseUrl, record.contentText])
  const images = useMemo(() => {
    const renderedUrls = collectImageUrls(record.contentText, assetBaseUrl)
    return extractRecordImages(record, assetBaseUrl).filter((url) => !renderedUrls.has(url))
  }, [assetBaseUrl, record])

  if (!html && images.length === 0) {
    return <p className="mkb-rich-empty">{shortText(record, 260)}</p>
  }

  return (
    <div className="mkb-document-rich">
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
      {images.length > 0 ? (
        <div className="mkb-rich-image-list">
          {images.map((url) => (
            <img key={url} src={url} alt="" loading="lazy" />
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
  const [editingParagraph, setEditingParagraph] = useState<ParagraphRow | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editProblems, setEditProblems] = useState<ParagraphProblemPayload[]>([])
  const [problemInputVisible, setProblemInputVisible] = useState(false)
  const [newProblemText, setNewProblemText] = useState('')
  const [loadingParagraphProblems, setLoadingParagraphProblems] = useState(false)
  const [savingParagraph, setSavingParagraph] = useState(false)
  const documentsRequestSeq = useRef(0)
  const editContentInputRef = useRef<any>(null)

  const selectedKnowledge = useMemo(
    () => knowledges.find((item) => item.idText === selectedKnowledgeId),
    [knowledges, selectedKnowledgeId],
  )
  const selectedDocument = useMemo(
    () => documents.find((item) => item.idText === selectedDocumentId),
    [documents, selectedDocumentId],
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

  function notify(type: NonNullable<NoticeState>['type'], text: string) {
    setNotice({ type, text })
  }

  const loadKnowledges = useCallback(async () => {
    setLoadingKnowledges(true)
    try {
      const payload = await getKnowledges({ page: 1, size: 100 })
      const rows = makeRows(extractRecords(payload), 'knowledge') as KnowledgeRow[]
      setKnowledges(rows)
      setKnowledgeTotal(extractTotal(payload, rows.length))
      setSelectedKnowledgeId((currentId) => (currentId && rows.some((item) => item.idText === currentId) ? currentId : ''))
    } catch (error) {
      notify('error', `知识库列表加载失败：${extractErrorMessage(error)}`)
    } finally {
      setLoadingKnowledges(false)
    }
  }, [])

  const loadAssetBaseUrl = useCallback(async () => {
    try {
      const config = await getKnowledgeOpenApiConfig()
      const base = config.accessUrl || config.adminBaseUrl
      setAssetBaseUrl(base ? new URL(base).origin : '')
    } catch {
      setAssetBaseUrl('')
    }
  }, [])

  const loadDocuments = useCallback(async (knowledgeId: string) => {
    const requestSeq = ++documentsRequestSeq.current
    setSelectedDocumentId('')
    setDocuments([])
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
  }, [])

  const loadParagraphs = useCallback(async (knowledgeId: string, documentId: string) => {
    if (!knowledgeId || !documentId) {
      return
    }

    setLoadingParagraphs(true)
    try {
      const payload = await getDocumentParagraphs(knowledgeId, documentId, { page: 1, size: 100 })
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
  }, [])

  async function openParagraphEditor(paragraph: ParagraphRow) {
    setEditingParagraph(paragraph)
    setEditTitle(paragraph.nameText === paragraph.idText ? '' : paragraph.nameText)
    setEditContent(paragraph.contentText)
    setEditProblems(recordProblemList(paragraph))
    setNewProblemText('')
    setProblemInputVisible(false)

    if (!selectedKnowledgeId || !selectedDocumentId || !paragraph.idText) {
      return
    }

    setLoadingParagraphProblems(true)
    try {
      const payload = await getDocumentParagraphProblems(selectedKnowledgeId, selectedDocumentId, paragraph.idText)
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
    if (!editingParagraph || !selectedKnowledgeId || !selectedDocumentId) {
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
      await updateDocumentParagraph(selectedKnowledgeId, selectedDocumentId, editingParagraph.idText, {
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
    void loadAssetBaseUrl()
    void loadKnowledges()
  }, [loadAssetBaseUrl, loadKnowledges])

  useEffect(() => {
    if (selectedKnowledgeId) {
      void loadDocuments(selectedKnowledgeId)
    }
  }, [loadDocuments, selectedKnowledgeId])

  useEffect(() => {
    if (selectedKnowledgeId && selectedDocumentId) {
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
              <h1>根目录 <span className="mkb-title-count">{knowledgeTotal}</span></h1>
              <div className="mkb-toolbar">
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
                <Button size="small" type="primary" onClick={notifyReadOnlyAction}>
                  创建
                </Button>
                <Button size="small" icon={<ReloadOutlined />} loading={loadingKnowledges} onClick={() => void loadKnowledges()} />
              </div>
            </header>
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
                <Button size="small" type="primary" icon={<CloudUploadOutlined />} onClick={notifyReadOnlyAction}>上传文档</Button>
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
                      <RichDocumentContent assetBaseUrl={assetBaseUrl} record={paragraph} />
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
