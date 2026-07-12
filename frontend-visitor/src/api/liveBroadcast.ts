import { apiClient } from './client'
import type { LiveStatus, LiveTimelineItem } from '../live/liveTimeline'

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
  items: Array<Omit<LiveTimelineItem, 'itemId'> & { id: number }>
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

export async function getLiveStatus(): Promise<LiveStatusSnapshot> {
  const { data } = await apiClient.get<VisitorLiveStatusResponse>('/user/live/status')
  const receivedAtClientMs = Date.now()
  const clockOffsetMs = Date.parse(data.serverTime) - receivedAtClientMs

  if (data.status !== 'published') {
    return { status: 'notPublished', serverTime: data.serverTime, receivedAtClientMs, clockOffsetMs }
  }

  return {
    ...data,
    status: 'live',
    items: data.items.map(({ id, ...item }) => ({ ...item, itemId: id })),
    receivedAtClientMs,
    clockOffsetMs,
  }
}
