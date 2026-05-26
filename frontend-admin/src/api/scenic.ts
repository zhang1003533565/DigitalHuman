import axios from 'axios'

export type ScenicCategory = {
  id: number
  name: string
  sortOrder: number
}

export type ScenicFacility = {
  id: number
  name: string
  categoryId: number
  categoryName: string
  longitude: number
  latitude: number
  image?: string | null
  galleryImages: string[]
  openTime?: string | null
  closeTime?: string | null
  createdAt: string
  updatedAt: string
}

export type ScenicCategoryPayload = {
  name: string
  sortOrder?: number
}

export type ScenicFacilityPayload = {
  name: string
  categoryId: number
  longitude: number
  latitude: number
  image?: string | null
  galleryImages?: string[]
  openTime?: string | null
  closeTime?: string | null
}

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
