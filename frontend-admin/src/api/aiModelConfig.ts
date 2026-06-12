import axios from 'axios'

const TIMEOUT = 8000
const TEST_TIMEOUT = 30000

/* ---------- Provider 配置 ---------- */
export type ProviderConfig = {
  provider: string
  baseUrl: string
  apiKey: string
  protocol?: string
}

export async function getProviderConfigs(): Promise<ProviderConfig[]> {
  const response = await axios.get<ProviderConfig[]>('/api/admin/settings/providers', { timeout: TIMEOUT })
  return response.data
}

export async function saveProviderConfig(config: ProviderConfig): Promise<ProviderConfig> {
  const response = await axios.put<ProviderConfig>('/api/admin/settings/providers', config, { timeout: TIMEOUT })
  return response.data
}

export async function deleteProviderConfig(config: ProviderConfig): Promise<void> {
  await axios.post('/api/admin/settings/providers/delete', config, { timeout: TIMEOUT })
}

/* ---------- 模型选项 & 选中状态 ---------- */
export type ModelSettings = {
  chatModel: string
  embeddingModel: string
  speechModel: string
  visionModel: string
  multimodalModel: string
}

export type ModelOption = {
  category: string
  provider: string
  modelId: string
}

export async function getModelSettings(): Promise<ModelSettings> {
  const response = await axios.get<ModelSettings>('/api/admin/settings/models', { timeout: TIMEOUT })
  return response.data
}

export async function addModelOption(option: ModelOption) {
  const response = await axios.post('/api/admin/settings/model-options', option, { timeout: TIMEOUT })
  return response.data
}

export async function selectModelOption(option: ModelOption) {
  const response = await axios.put('/api/admin/settings/model-options/select', option, { timeout: TIMEOUT })
  return response.data
}

/* ---------- 模型测试（超时更长，因为涉及真实模型调用） ---------- */
export type ModelTestRequest = {
  category: string
  modelId: string
  text: string
  imageDataUrl?: string
  mode?: string
}

export type ModelTestResponse = {
  success: boolean
  provider: string
  category: string
  modelId: string
  message: string
  detail?: string
  caption?: string
  ocrText?: string
  modelAnswer?: string
  sceneSummary?: string
}

export async function testModel(request: ModelTestRequest): Promise<ModelTestResponse> {
  const response = await axios.post<ModelTestResponse>('/api/admin/settings/model-test', request, { timeout: TEST_TIMEOUT })
  return response.data
}
