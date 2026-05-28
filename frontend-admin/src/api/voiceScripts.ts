import axios from 'axios'

export type VoiceScriptScene = {
  id: number
  scenicName: string
  spotId: string
  spotName: string
  sceneType: 'overview' | 'spot' | 'transition'
  style: 'culture' | 'family' | 'light'
  title: string
  scriptText: string
  ssmlText: string
  durationSec: number
  versionNo: number
  status: 'draft' | 'published' | 'archived'
  sourceFile: string
  createdAt: string
  updatedAt: string
}

export type VoiceScriptScenePayload = Omit<
  VoiceScriptScene,
  'id' | 'createdAt' | 'updatedAt'
>

export type VoiceScriptImportIssue = {
  rowNumber: number
  reason: string
}

export type VoiceScriptImportResponse = {
  importedCount: number
  totalCount: number
  skippedCount: number
  issues: VoiceScriptImportIssue[]
}

export async function getVoiceScriptRecords() {
  const response = await axios.get<VoiceScriptScene[]>('/api/admin/voice-scripts/records')
  return response.data
}

export async function importVoiceScriptDocx(file: File, scenicName: string, style: string, versionNo: number) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('scenicName', scenicName)
  formData.append('style', style)
  formData.append('versionNo', String(versionNo))
  const response = await axios.post<VoiceScriptImportResponse>('/api/admin/voice-scripts/import-docx', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export async function createVoiceScriptRecord(payload: VoiceScriptScenePayload) {
  const response = await axios.post<VoiceScriptScene>('/api/admin/voice-scripts/records', payload)
  return response.data
}

export async function updateVoiceScriptRecord(id: number, payload: VoiceScriptScenePayload) {
  const response = await axios.put<VoiceScriptScene>(`/api/admin/voice-scripts/records/${id}`, payload)
  return response.data
}

export async function deleteVoiceScriptRecord(id: number) {
  await axios.delete(`/api/admin/voice-scripts/records/${id}`)
}

export async function publishVoiceScriptRecord(id: number) {
  const response = await axios.post<VoiceScriptScene>(`/api/admin/voice-scripts/records/${id}/publish`)
  return response.data
}
