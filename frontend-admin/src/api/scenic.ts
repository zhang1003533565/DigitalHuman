import axios from 'axios'

export type ScenicCategory = {
  id: number
  name: string
  sortOrder: number
  mapVisible: boolean
}

export type ScenicFacility = {
  id: number
  spotCode?: string | null
  name: string
  shortDescription?: string | null
  locationDescription?: string | null
  categoryId: number
  categoryName: string
  longitude: number
  latitude: number
  image?: string | null
  galleryImages: string[]
  openTime?: string | null
  closeTime?: string | null
  mapVisible: boolean
  createdAt: string
  updatedAt: string
}

export type ScenicCategoryPayload = {
  name: string
  sortOrder?: number
  mapVisible?: boolean
}

export type ScenicFacilityPayload = {
  spotCode?: string | null
  name: string
  shortDescription?: string | null
  locationDescription?: string | null
  categoryId: number
  longitude: number
  latitude: number
  image?: string | null
  galleryImages?: string[]
  openTime?: string | null
  closeTime?: string | null
  mapVisible?: boolean
}

export type ScenicFacilityVoiceScript = {
  id: number
  facilityId?: number | null
  spotId: string
  title: string
  style: string
  versionNo: number
  durationSec: number
  audioUrl?: string
}

export type ScenicFacilityContent = {
  facilityId?: number
  architectureLandscapeParams?: string
  coreFunction?: string
  culturalConnotation?: string
  detailedIntroduction?: string
  highlights?: string
  performanceOpenInfo?: string
  visitorNotes?: string
  remark?: string
  sourceRecordId?: number | null
  contentVersion?: number
  audioEnabled: boolean
  liveEnabled: boolean
  defaultExperience?: 'audio' | 'live' | null
  boundVoiceScriptId?: number | null
  liveSourceType?: 'video' | 'stream' | 'camera' | null
  liveVideoUrl?: string
  liveStreamUrl?: string
  cameraStreamKey?: string
}

export type ScenicLiveVideoUploadResponse = { url: string; fileName?: string }

export async function getScenicCategories() {
  const response = await axios.get<ScenicCategory[]>('/api/admin/scenic/categories')
  return response.data
}

export async function createScenicCategory(payload: ScenicCategoryPayload) {
  const response = await axios.post<ScenicCategory>('/api/admin/scenic/categories', payload)
  return response.data
}

export async function updateScenicCategory(id: number, payload: ScenicCategoryPayload) {
  const response = await axios.put<ScenicCategory>(`/api/admin/scenic/categories/${id}`, payload)
  return response.data
}

export async function deleteScenicCategory(id: number) {
  await axios.delete(`/api/admin/scenic/categories/${id}`)
}

export async function getScenicFacilities() {
  const response = await axios.get<ScenicFacility[]>('/api/admin/scenic/facilities')
  return response.data.map((item) => ({
    ...item,
    galleryImages: item.galleryImages ?? [],
  }))
}

export async function getScenicFacility(id: number) {
  const response = await axios.get<ScenicFacility>(`/api/admin/scenic/facilities/${id}`)
  return {
    ...response.data,
    galleryImages: response.data.galleryImages ?? [],
  }
}

export async function createScenicFacility(payload: ScenicFacilityPayload) {
  const response = await axios.post<ScenicFacility>('/api/admin/scenic/facilities', payload)
  return response.data
}

export async function updateScenicFacility(id: number, payload: ScenicFacilityPayload) {
  const response = await axios.put<ScenicFacility>(`/api/admin/scenic/facilities/${id}`, payload)
  return response.data
}

export async function deleteScenicFacility(id: number) {
  await axios.delete(`/api/admin/scenic/facilities/${id}`)
}

export async function getScenicFacilityContent(id: number) {
  const response = await axios.get<ScenicFacilityContent>(`/api/admin/scenic/facilities/${id}/content`)
  return response.data
}

export async function saveScenicFacilityContent(id: number, payload: ScenicFacilityContent) {
  const response = await axios.put<ScenicFacilityContent>(`/api/admin/scenic/facilities/${id}/content`, payload)
  return response.data
}

export async function getScenicFacilityVoiceScripts(id: number) {
  const response = await axios.get<ScenicFacilityVoiceScript[]>(`/api/admin/scenic/facilities/${id}/voice-scripts`)
  return response.data
}

export async function uploadScenicLiveVideo(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await axios.post<ScenicLiveVideoUploadResponse>(
    '/api/admin/scenic-structured/media/upload',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}
