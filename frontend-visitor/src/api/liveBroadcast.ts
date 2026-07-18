import { apiClient, getApiProblem } from './client.ts'
import type { LiveStatus, LiveTimelineItem } from '../live/liveTimeline.ts'

type PublishedLiveStatus = {
  status: 'published'
  serverTime: string
  versionId: number
  publishedAt: string
  totalDurationMs: number
  currentItemId: number
  currentItemIndex: number
  currentItemOffsetMs: number
  cycleOffsetMs: number
  items: LiveTimelineItem[]
}

type NotPublishedLiveStatus = {
  status: 'notPublished'
  serverTime: string
}

type VisitorLiveStatusResponse = PublishedLiveStatus | NotPublishedLiveStatus

export type LiveStatusSnapshot = LiveStatus & {
  serverTime: string
  receivedAtClientMs: number
  clockOffsetMs: number
}

type GetLiveStatusOptions = {
  signal?: AbortSignal
  now?: () => number
}

export type FacilityLiveDigitalHuman = {
  id: number
  modelKey: string
  displayName: string
  modelPath: string
}

export type FacilityLiveNarration = {
  scriptId: number
  title: string
  audioUrl: string
  durationSec: number
  versionNo: number
}

export type FacilityLiveConfig = {
  facilityId: number
  facilityName: string
  available: boolean
  unavailableReason?: 'LIVE_DISABLED' | 'DIGITAL_HUMAN_UNAVAILABLE' | string | null
  liveSourceType?: 'video' | 'stream' | 'camera' | null
  liveVideoUrl?: string | null
  liveStreamUrl?: string | null
  cameraStreamKey?: string | null
  digitalHuman?: FacilityLiveDigitalHuman | null
  narration?: FacilityLiveNarration | null
}

export async function getFacilityLiveConfig(facilityId: number, options: { signal?: AbortSignal } = {}) {
  try {
    const response = await apiClient.get<FacilityLiveConfig>('/user/live/config', {
      params: { facilityId },
      signal: options.signal,
    })
    return response.data
  } catch (error) {
    throw new Error(getApiProblem(error).message, { cause: error })
  }
}

export async function getLiveStatus(options: GetLiveStatusOptions = {}): Promise<LiveStatusSnapshot> {
  const now = options.now ?? Date.now
  const sentAtClientMs = now()
  let data: VisitorLiveStatusResponse
  try {
    const response = await apiClient.get<VisitorLiveStatusResponse>('/user/live/status', { signal: options.signal })
    data = response.data
  } catch (error) {
    throw new Error(getApiProblem(error).message, { cause: error })
  }
  const receivedAtClientMs = now()
  const clientMidpointMs = sentAtClientMs + (receivedAtClientMs - sentAtClientMs) / 2
  const clockOffsetMs = Date.parse(data.serverTime) - clientMidpointMs

  if (data.status !== 'published') {
    return { status: 'notPublished', serverTime: data.serverTime, receivedAtClientMs, clockOffsetMs }
  }

  return {
    ...data,
    status: 'live',
    items: data.items,
    receivedAtClientMs,
    clockOffsetMs,
  }
}
