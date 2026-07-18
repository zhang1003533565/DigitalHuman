import axios from 'axios'

export type VoiceScriptStatus = 'draft' | 'published' | 'archived'
export type VoiceScriptAudioStatus = 'missing' | 'ready' | 'stale' | 'failed'
export type VoiceScriptGenerationMode = 'manual' | 'ai' | 'knowledge' | 'docx'

export type VoiceScriptScene = {
  id: number
  facilityId?: number | null
  scenicName: string
  spotId: string
  spotName: string
  sceneType: 'overview' | 'spot' | 'transition'
  style: 'culture' | 'family' | 'light'
  title: string
  scriptText: string
  ssmlText?: string
  durationSec: number
  versionNo: number
  status: VoiceScriptStatus
  sourceFile?: string
  generationMode?: VoiceScriptGenerationMode
  targetDurationSec?: number
  sourceRefsJson?: string
  audioStatus?: VoiceScriptAudioStatus
  audioUrl?: string
  audioFileName?: string
  voiceId?: string
  speechRate?: string
  speechVolume?: string
  speechPitch?: string
  audioScriptHash?: string
  audioGeneratedAt?: string
  createdAt: string
  updatedAt: string
}

export type VoiceScriptScenePayload = Pick<
  VoiceScriptScene,
  | 'scenicName'
  | 'facilityId'
  | 'spotId'
  | 'spotName'
  | 'sceneType'
  | 'style'
  | 'title'
  | 'scriptText'
  | 'ssmlText'
  | 'durationSec'
  | 'versionNo'
  | 'status'
  | 'sourceFile'
>

export type VoiceScriptKnowledgeSource = {
  knowledgeId: string
  knowledgeName: string
  documentIds: string[]
}

export type VoiceScriptGeneratePayload = {
  accountId: number
  facilityId: number
  spotId: string
  style: VoiceScriptScene['style']
  targetDurationSec: number
  additionalRequirements?: string
  knowledgeSources: VoiceScriptKnowledgeSource[]
}

export type VoiceScriptSynthesizePayload = {
  voiceId: string
  speechRate: string
  speechVolume: string
  speechPitch: string
}

export async function getVoiceScriptRecords() {
  const response = await axios.get<VoiceScriptScene[]>('/api/admin/voice-scripts/records')
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

export async function generateVoiceScript(payload: VoiceScriptGeneratePayload) {
  const response = await axios.post<VoiceScriptScene>('/api/admin/voice-scripts/generate', payload)
  return response.data
}

export async function synthesizeVoiceScriptRecord(id: number, payload: VoiceScriptSynthesizePayload) {
  const response = await axios.post<VoiceScriptScene>(`/api/admin/voice-scripts/records/${id}/synthesize`, payload)
  return response.data
}

export async function rollbackVoiceScriptRecord(id: number) {
  const response = await axios.post<VoiceScriptScene>(`/api/admin/voice-scripts/records/${id}/rollback`)
  return response.data
}

export async function publishVoiceScriptRecord(id: number) {
  const response = await axios.post<VoiceScriptScene>(`/api/admin/voice-scripts/records/${id}/publish`)
  return response.data
}
