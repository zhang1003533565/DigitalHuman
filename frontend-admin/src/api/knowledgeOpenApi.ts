import axios from 'axios'

export type MaxKbResponse<T = unknown> = {
  code?: number
  message?: string
  data?: T
}

export type ApiResult<T = unknown> = {
  code?: number
  msg?: string
  data?: T
}

export type PageResponse<T> = {
  records: T[]
  total: number
  page: number
  size: number
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

export type MaxKbAccount = {
  id: number
  accountName: string
  baseUrl: string
  environment: string
  environmentText?: string
  workspaceId: string
  remark?: string
  status: number
  statusText?: string
  apiKeyConfigured?: boolean
  apiKeyMasked?: string
  createTime?: string
  updateTime?: string
}

export type MaxKbEnvironmentOption = {
  value: string
  label: string
  description?: string
}

export type MaxKbAccountPayload = {
  accountName: string
  baseUrl: string
  environment: string
  apiKey?: string
  workspaceId: string
  remark?: string
  status: number
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

export type MaxKbUploadDocumentsPayload = {
  files?: File[]
  fileIds?: string[]
  limit?: number
  patterns?: string[]
  withFilter?: boolean
  splitStrategy?: 'llm_text' | 'llm_vision' | string
  modelId?: string
  visionModelId?: string
  llmModelId?: string
  qualityOptimize?: boolean
  autoApply?: boolean
  idempotencyKey?: string
}

export type MaxKbUploadModelType = 'LLM' | 'IMAGE'

export type MaxKbUploadModel = {
  id: string
  name: string
  model_name?: string
  model_type: MaxKbUploadModelType
  provider?: string
  scope?: 'workspace' | 'shared'
}

function unwrap<T>(payload: MaxKbResponse<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as MaxKbResponse<T>).data as T
  }
  return payload as T
}

function unwrapApiResult<T>(payload: ApiResult<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiResult<T>).data as T
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

export async function listKnowledgeAccounts(params?: {
  current?: number
  size?: number
  keyword?: string
  environment?: string
  status?: number
}) {
  const response = await axios.get<ApiResult<PageResponse<MaxKbAccount>>>('/api/admin/knowledge/maxkb/accounts', { params })
  return unwrapApiResult(response.data)
}

export async function listKnowledgeAccountEnvironments() {
  const response = await axios.get<ApiResult<MaxKbEnvironmentOption[]>>('/api/admin/knowledge/maxkb/environments')
  return unwrapApiResult(response.data)
}

export async function createKnowledgeAccount(payload: MaxKbAccountPayload) {
  const response = await axios.post<ApiResult<MaxKbAccount>>('/api/admin/knowledge/maxkb/accounts', payload)
  return unwrapApiResult(response.data)
}

export async function updateKnowledgeAccount(accountId: number, payload: MaxKbAccountPayload) {
  const response = await axios.put<ApiResult<MaxKbAccount>>(`/api/admin/knowledge/maxkb/accounts/${accountId}`, payload)
  return unwrapApiResult(response.data)
}

export async function deleteKnowledgeAccount(accountId: number) {
  const response = await axios.delete<ApiResult<void>>(`/api/admin/knowledge/maxkb/accounts/${accountId}`)
  return response.data
}

export async function updateKnowledgeAccountStatus(accountId: number, status: number) {
  const response = await axios.put<ApiResult<MaxKbAccount>>(`/api/admin/knowledge/maxkb/accounts/${accountId}/status`, { status })
  return unwrapApiResult(response.data)
}

export async function testKnowledgeAccount(accountId: number) {
  const response = await axios.post<ApiResult<unknown>>(`/api/admin/knowledge/maxkb/accounts/${accountId}/test`)
  return unwrapApiResult(response.data)
}

export async function getKnowledgeModels(accountId: number, modelType: MaxKbUploadModelType) {
  const response = await axios.get<ApiResult<MaxKbResponse<MaxKbUploadModel[]>>>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/models`,
    { params: { model_type: modelType } },
  )
  return extractRecords(unwrapApiResult(response.data)) as MaxKbUploadModel[]
}

export async function getKnowledges(accountId: number, params?: Record<string, string | number | undefined>) {
  const response = await axios.get<MaxKbResponse>(`/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges`, { params })
  return unwrapApiResult(response.data)
}

export async function getKnowledgeDetail(accountId: number, knowledgeId: string) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}`,
  )
  return unwrapApiResult(response.data)
}

export async function getKnowledgeDocuments(accountId: number, knowledgeId: string, params?: Record<string, string | number | undefined>) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents`,
    { params },
  )
  return unwrapApiResult(response.data)
}

export async function uploadKnowledgeDocuments(
  accountId: number,
  knowledgeId: string,
  payload: MaxKbUploadDocumentsPayload,
) {
  const formData = new FormData()
  payload.files?.forEach((file) => {
    formData.append('file', file)
  })
  payload.fileIds?.filter(Boolean).forEach((fileId) => {
    formData.append('file_id', fileId)
  })
  if (payload.limit != null) formData.append('limit', String(payload.limit))
  payload.patterns?.filter(Boolean).forEach((pattern) => {
    formData.append('patterns', pattern)
  })
  if (payload.withFilter != null) formData.append('with_filter', String(payload.withFilter))
  if (payload.splitStrategy) formData.append('split_strategy', payload.splitStrategy)
  if (payload.modelId) formData.append('model_id', payload.modelId)
  if (payload.visionModelId) formData.append('vision_model_id', payload.visionModelId)
  if (payload.llmModelId) formData.append('llm_model_id', payload.llmModelId)
  if (payload.qualityOptimize != null) formData.append('quality_optimize', String(payload.qualityOptimize))
  if (payload.autoApply != null) formData.append('auto_apply', String(payload.autoApply))
  if (payload.idempotencyKey) formData.append('idempotency_key', payload.idempotencyKey)

  const response = await axios.post<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload`,
    formData,
    payload.idempotencyKey ? { headers: { 'Idempotency-Key': payload.idempotencyKey } } : undefined,
  )
  return unwrapApiResult(response.data)
}

export async function listKnowledgeUploadTasks(
  accountId: number,
  knowledgeId: string,
  params?: Record<string, string | number | undefined>,
) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload-tasks`,
    { params },
  )
  return unwrapApiResult(response.data)
}

export async function getKnowledgeUploadTask(accountId: number, knowledgeId: string, taskId: string) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload-tasks/${encodeURIComponent(taskId)}`,
  )
  return unwrapApiResult(response.data)
}

export async function previewKnowledgeUploadTask(
  accountId: number,
  knowledgeId: string,
  taskId: string,
  params?: Record<string, string | number | undefined>,
) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload-tasks/${encodeURIComponent(taskId)}/preview`,
    { params },
  )
  return unwrapApiResult(response.data)
}

export async function applyKnowledgeUploadTask(accountId: number, knowledgeId: string, taskId: string) {
  const response = await axios.post<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload-tasks/${encodeURIComponent(taskId)}/apply`,
  )
  return unwrapApiResult(response.data)
}

export async function cancelKnowledgeUploadTask(accountId: number, knowledgeId: string, taskId: string) {
  const response = await axios.post<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload-tasks/${encodeURIComponent(taskId)}/cancel`,
  )
  return unwrapApiResult(response.data)
}

export async function deleteKnowledgeUploadTask(accountId: number, knowledgeId: string, taskId: string) {
  const response = await axios.delete<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/upload-tasks/${encodeURIComponent(taskId)}`,
  )
  return unwrapApiResult(response.data)
}

export async function getDocumentParagraphs(
  accountId: number,
  knowledgeId: string,
  documentId: string,
  params?: Record<string, string | number | undefined>,
) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/${encodeURIComponent(documentId)}/paragraphs`,
    { params },
  )
  return unwrapApiResult(response.data)
}

export async function getDocumentParagraphProblems(
  accountId: number,
  knowledgeId: string,
  documentId: string,
  paragraphId: string,
) {
  const response = await axios.get<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/${encodeURIComponent(documentId)}/paragraphs/${encodeURIComponent(paragraphId)}/problems`,
  )
  return unwrapApiResult(response.data)
}

export async function updateDocumentParagraph(
  accountId: number,
  knowledgeId: string,
  documentId: string,
  paragraphId: string,
  payload: ParagraphUpdatePayload,
) {
  const response = await axios.put<MaxKbResponse>(
    `/api/admin/knowledge/maxkb/accounts/${accountId}/knowledges/${encodeURIComponent(knowledgeId)}/documents/${encodeURIComponent(documentId)}/paragraphs/${encodeURIComponent(paragraphId)}`,
    payload,
  )
  return unwrapApiResult(response.data)
}

export function getKnowledgeAssetUrl(path: string, accountId?: number) {
  if (accountId) {
    return `/api/admin/knowledge/maxkb/accounts/${accountId}/assets?path=${encodeURIComponent(path || '')}`
  }
  return `/api/admin/knowledge/assets?path=${encodeURIComponent(path || '')}`
}

export async function runKnowledgeHitTest(accountId: number, payload: HitTestPayload) {
  const response = await axios.post<MaxKbResponse>(`/api/admin/knowledge/maxkb/accounts/${accountId}/hit-test`, payload)
  return unwrapApiResult(response.data)
}
