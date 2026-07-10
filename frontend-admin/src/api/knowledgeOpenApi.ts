import axios from 'axios'

export type MaxKbResponse<T = unknown> = {
  code?: number
  message?: string
  data?: T
}

export type MaxKbRecord = Record<string, unknown>

export type MaxKbOpenApiConfig = {
  adminBaseUrl: string
  workspaceId: string
  accessUrl: string
  apiKey: string
  keyId?: string
  keyName?: string
  defaultKnowledgeId?: string
  configured?: boolean
}

export type MaxKbOpenApiKey = {
  id?: string
  name?: string
  secret_key?: string
  workspace_id?: string
  workspace_name?: string
  is_active?: boolean
}

export type MaxKbSyncKeysPayload = {
  adminBaseUrl: string
  workspaceId: string
  adminToken: string
}

export type HitTestPayload = {
  knowledge_id?: string
  knowledge_id_list?: string[]
  query_text: string
  top_number?: number
  similarity?: number
  search_mode?: 'embedding' | 'keywords' | 'blend'
}

export type ParagraphProblemPayload = {
  id?: string
  content: string
}

export type ParagraphUpdatePayload = {
  title?: string
  content: string
  is_active?: boolean
  problem_list?: ParagraphProblemPayload[]
}

function unwrap<T>(payload: MaxKbResponse<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as MaxKbResponse<T>).data as T
  }
  return payload as T
}

export function extractRecords(payload: unknown): MaxKbRecord[] {
  const data = unwrap(payload)
  if (Array.isArray(data)) {
    return data as MaxKbRecord[]
  }
  if (!data || typeof data !== 'object') {
    return []
  }
  const record = data as Record<string, unknown>
  for (const key of ['records', 'list', 'rows', 'items', 'documents', 'knowledges', 'paragraphs', 'data']) {
    const value = record[key]
    if (Array.isArray(value)) {
      return value as MaxKbRecord[]
    }
    if (value && typeof value === 'object') {
      const nested = extractRecords(value)
      if (nested.length) {
        return nested
      }
    }
  }
  return []
}

export function extractTotal(payload: unknown, fallback: number) {
  const data = unwrap(payload)
  if (!data || typeof data !== 'object') {
    return fallback
  }
  const record = data as Record<string, unknown>
  const total = record.total ?? record.count
  return typeof total === 'number' ? total : fallback
}

export async function getKnowledgeOpenApiDocs() {
  const response = await axios.get<MaxKbResponse>('/api/admin/knowledge/open-api/docs')
  return response.data
}

export async function getKnowledgeOpenApiConfig() {
  const response = await axios.get<MaxKbOpenApiConfig>('/api/admin/knowledge/open-api/config')
  return response.data
}

export async function saveKnowledgeOpenApiConfig(payload: Partial<MaxKbOpenApiConfig>) {
  const response = await axios.post<MaxKbOpenApiConfig>('/api/admin/knowledge/open-api/config', payload)
  return response.data
}

export async function syncKnowledgeOpenApiKeys(payload: MaxKbSyncKeysPayload) {
  const response = await axios.post<{
    adminBaseUrl: string
    workspaceId: string
    accessUrl: string
    keys: MaxKbOpenApiKey[]
  }>('/api/admin/knowledge/open-api/sync-keys', payload)
  return response.data
}

export async function getKnowledges(params?: Record<string, string | number | undefined>) {
  const response = await axios.get<MaxKbResponse>('/api/admin/knowledge/knowledges', { params })
  return response.data
}

export async function getKnowledgeDetail(knowledgeId: string) {
  const response = await axios.get<MaxKbResponse>(`/api/admin/knowledge/knowledges/${encodeURIComponent(knowledgeId)}`)
  return response.data
}

export async function getKnowledgeDocuments(knowledgeId: string, params?: Record<string, string | number | undefined>) {
  const response = await axios.get<MaxKbResponse>(`/api/admin/knowledge/knowledges/${encodeURIComponent(knowledgeId)}/documents`, { params })
  return response.data
}

export async function getDocumentParagraphs(
  knowledgeId: string,
  documentId: string,
  params?: Record<string, string | number | undefined>,
) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/knowledges/${encodeURIComponent(knowledgeId)}/documents/${encodeURIComponent(documentId)}/paragraphs`,
    { params },
  )
  return response.data
}

export async function getDocumentParagraphProblems(
  knowledgeId: string,
  documentId: string,
  paragraphId: string,
) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/knowledges/${encodeURIComponent(knowledgeId)}/documents/${encodeURIComponent(documentId)}/paragraphs/${encodeURIComponent(paragraphId)}/problems`,
  )
  return response.data
}

export async function updateDocumentParagraph(
  knowledgeId: string,
  documentId: string,
  paragraphId: string,
  payload: ParagraphUpdatePayload,
) {
  const response = await axios.put<MaxKbResponse>(
    `/api/admin/knowledge/knowledges/${encodeURIComponent(knowledgeId)}/documents/${encodeURIComponent(documentId)}/paragraphs/${encodeURIComponent(paragraphId)}`,
    payload,
  )
  return response.data
}

export async function runKnowledgeHitTest(payload: HitTestPayload) {
  const response = await axios.post<MaxKbResponse>('/api/admin/knowledge/hit-test', payload)
  return response.data
}
