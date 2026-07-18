import axios from 'axios'

export type TravelAnalyticsRecord = {
  id: number
  tourist_id: string
  user_nickname: string
  age: string
  gender: string
  attraction_name: string
  attraction_content: string
  attraction_type: string
  visit_date: string
  stay_duration: string
  ticket_cost: string
  food_cost: string
  shopping_cost: string
  transport_cost: string
  entertainment_cost: string
  total_cost: string
  group_size: string
  satisfaction: string
}

export type TravelAnalyticsRecordPayload = Omit<TravelAnalyticsRecord, 'id'>

export type TravelAnalyticsImportIssue = {
  rowNumber: number
  reason: string
}

export type TravelAnalyticsImportResponse = {
  importedCount: number
  totalCount: number
  skippedEmptyCount: number
  skippedDuplicateCount: number
  issues: TravelAnalyticsImportIssue[]
}

export type TravelAnalyticsPageResponse = {
  records: TravelAnalyticsRecord[]
  total: number
  page: number
  size: number
}

export const TRAVEL_ANALYTICS_AI_METRICS = [
  'popular_attractions',
  'average_stay_duration',
  'average_spend',
  'average_satisfaction',
  'common_visitor_segments',
] as const

export type TravelAnalyticsMetric = (typeof TRAVEL_ANALYTICS_AI_METRICS)[number]

export type TravelAnalyticsAiConfig = {
  id: string
  publicEnabled: boolean
  minimumSampleSize: number
  updatedAt: string
}

export type TravelAnalyticsMetricItem = {
  label: string
  value: number
}

export type TravelAnalyticsMetricResponse = {
  metric: TravelAnalyticsMetric
  scope: 'PUBLIC' | 'ADMIN'
  totalSamples: number
  validSamples: number
  asOf: string
  items: TravelAnalyticsMetricItem[]
  methodology: string
  warning: string | null
}

export async function getTravelAnalyticsRecords(page = 0, size = 20) {
  const response = await axios.get<TravelAnalyticsPageResponse>('/api/admin/travel-analytics/records', {
    params: { page, size },
  })
  return response.data
}

export async function getTravelAnalyticsAiConfig() {
  const response = await axios.get<TravelAnalyticsAiConfig>('/api/admin/travel-analytics/ai-config')
  return response.data
}

export async function getTravelAnalyticsMetricSummary(metric: TravelAnalyticsMetric) {
  const response = await axios.get<TravelAnalyticsMetricResponse>(`/api/admin/travel-analytics/metrics/${metric}`)
  return response.data
}

export async function updateTravelAnalyticsAiConfig(payload: Pick<TravelAnalyticsAiConfig, 'publicEnabled' | 'minimumSampleSize'>) {
  const response = await axios.put<TravelAnalyticsAiConfig>('/api/admin/travel-analytics/ai-config', payload)
  return response.data
}

export async function testTravelAnalyticsMetric(metric: TravelAnalyticsMetric) {
  const response = await axios.post<TravelAnalyticsMetricResponse>(`/api/admin/travel-analytics/metrics/${metric}/test`)
  return response.data
}

export async function importTravelAnalyticsExcel(
  file: File,
  replaceAll = false,
  onProgress?: (percent: number) => void,
) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('replaceAll', String(replaceAll))
  const response = await axios.post<TravelAnalyticsImportResponse>('/api/admin/travel-analytics/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (event) => {
      if (!event.total) return
      onProgress?.(Math.round((event.loaded * 100) / event.total))
    },
  })
  return response.data
}

export async function downloadTravelAnalyticsTemplate() {
  const response = await axios.get('/api/admin/travel-analytics/template', { responseType: 'blob' })
  return response.data as Blob
}

export async function createTravelAnalyticsRecord(payload: TravelAnalyticsRecordPayload) {
  const response = await axios.post<TravelAnalyticsRecord>('/api/admin/travel-analytics/records', payload)
  return response.data
}

export async function updateTravelAnalyticsRecord(id: number, payload: TravelAnalyticsRecordPayload) {
  const response = await axios.put<TravelAnalyticsRecord>(`/api/admin/travel-analytics/records/${id}`, payload)
  return response.data
}

export async function deleteTravelAnalyticsRecord(id: number) {
  await axios.delete(`/api/admin/travel-analytics/records/${id}`)
}
