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

export async function getTravelAnalyticsRecords() {
  const response = await axios.get<TravelAnalyticsRecord[]>('/api/admin/travel-analytics/records')
  return response.data
}

export async function importTravelAnalyticsExcel(file: File, replaceAll = false) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('replaceAll', String(replaceAll))
  const response = await axios.post<TravelAnalyticsImportResponse>('/api/admin/travel-analytics/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
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
