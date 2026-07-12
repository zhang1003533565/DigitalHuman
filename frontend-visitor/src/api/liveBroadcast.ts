import { apiClient } from './client.ts'
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

export async function getLiveStatus(options: GetLiveStatusOptions = {}): Promise<LiveStatusSnapshot> {
  const now = options.now ?? Date.now
  const sentAtClientMs = now()
  const { data } = await apiClient.get<VisitorLiveStatusResponse>('/user/live/status', { signal: options.signal })
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
