import axios from 'axios'

export type ScenicStructuredRecord = {
  id: number
  scenic_name: string
  spot_id: string
  spot_name: string
  location: string
  architecture_landscape_params: string
  core_function: string
  cultural_connotation: string
  detailed_introduction: string
  highlights: string
  performance_open_info: string
  remark: string
}

export type ScenicStructuredRecordPayload = Omit<ScenicStructuredRecord, 'id'>

export type ScenicStructuredImportIssue = {
  rowNumber: number
  reason: string
}

export type ScenicStructuredImportResponse = {
  importedCount: number
  totalCount: number
  skippedEmptyCount: number
  skippedDuplicateCount: number
  issues: ScenicStructuredImportIssue[]
}

export async function getScenicStructuredRecords() {
  const response = await axios.get<ScenicStructuredRecord[]>('/api/admin/scenic-structured/records')
  return response.data
}

export async function importScenicStructuredDocx(file: File, replaceAll = false) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('replaceAll', String(replaceAll))
  const response = await axios.post<ScenicStructuredImportResponse>('/api/admin/scenic-structured/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export async function downloadScenicStructuredTemplate() {
  const response = await axios.get('/api/admin/scenic-structured/template', { responseType: 'blob' })
  return response.data as Blob
}

export async function createScenicStructuredRecord(payload: ScenicStructuredRecordPayload) {
  const response = await axios.post<ScenicStructuredRecord>('/api/admin/scenic-structured/records', payload)
  return response.data
}

export async function updateScenicStructuredRecord(id: number, payload: ScenicStructuredRecordPayload) {
  const response = await axios.put<ScenicStructuredRecord>(`/api/admin/scenic-structured/records/${id}`, payload)
  return response.data
}

export async function deleteScenicStructuredRecord(id: number) {
  await axios.delete(`/api/admin/scenic-structured/records/${id}`)
}
