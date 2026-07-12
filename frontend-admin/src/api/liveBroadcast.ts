import axios from 'axios'

const BASE_PATH = '/api/admin/live-broadcast'

export type LiveScriptItem = {
  id: number
  title: string
  content: string
  durationMs: number
  sortOrder: number
  enabled: boolean
  updatedAt?: string
}

export type LiveScriptItemPayload = Pick<
  LiveScriptItem,
  'title' | 'content' | 'durationMs' | 'sortOrder' | 'enabled'
>

export type LivePublishSummary = {
  versionId: number
  publishedAt: string
  totalDurationMs: number
  itemCount: number
}

export const listLiveItems = async () =>
  (await axios.get<LiveScriptItem[]>(`${BASE_PATH}/items`)).data

export const createLiveItem = async (payload: LiveScriptItemPayload) =>
  (await axios.post<LiveScriptItem>(`${BASE_PATH}/items`, payload)).data

export const updateLiveItem = async (id: number, payload: LiveScriptItemPayload) =>
  (await axios.put<LiveScriptItem>(`${BASE_PATH}/items/${id}`, payload)).data

export const deleteLiveItem = async (id: number) => {
  await axios.delete(`${BASE_PATH}/items/${id}`)
}

export const reorderLiveItems = async (ids: number[]) =>
  (await axios.put<LiveScriptItem[]>(`${BASE_PATH}/items/reorder`, ids)).data

export const publishLiveBroadcast = async () =>
  (await axios.post<LivePublishSummary>(`${BASE_PATH}/publish`)).data

export const getPublishedLiveSummary = async () =>
  (await axios.get<LivePublishSummary | null>(`${BASE_PATH}/published`)).data
