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
  matchedFacilityId?: number | null
  matchStatus?: 'unmatched' | 'suggested' | 'matched'
  applyStatus?: 'pending' | 'applied'
  lastAppliedAt?: string | null
}

export type ScenicStructuredRecordPayload = Omit<ScenicStructuredRecord, 'id'>

export type ScenicStructuredFieldDiff = {
  key: string
  label: string
  currentValue: string
  importedValue: string
  changed: boolean
}

export type ScenicStructuredApplyPreview = {
  recordId: number
  facilityId: number
  fields: ScenicStructuredFieldDiff[]
}

export type ScenicStructuredApplyPayload = {
  facilityId: number
  mode: 'fill_empty' | 'selected' | 'overwrite_all'
  fields: string[]
}

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

export async function previewScenicStructuredApply(recordId: number, facilityId: number) {
  const response = await axios.get<ScenicStructuredApplyPreview>(
    `/api/admin/scenic-structured/records/${recordId}/apply-preview`,
    { params: { facilityId } },
  )
  return response.data
}

export async function matchScenicStructuredRecord(recordId: number, facilityId: number) {
  const response = await axios.post<ScenicStructuredRecord>(
    `/api/admin/scenic-structured/records/${recordId}/match`,
    undefined,
    { params: { facilityId } },
  )
  return response.data
}

export async function applyScenicStructuredRecord(recordId: number, payload: ScenicStructuredApplyPayload) {
  const response = await axios.post(`/api/admin/scenic-structured/records/${recordId}/apply`, payload)
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
