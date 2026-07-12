export type LiveTimelineItem = {
  itemId: number
  title: string
  content: string
  durationMs: number
  sortOrder: number
}

export type LiveStatus = {
  status: 'live' | 'notPublished'
  versionId?: number
  publishedAt?: string
  totalDurationMs?: number
  items?: LiveTimelineItem[]
}

export type LivePosition = {
  versionId: number
  item: LiveTimelineItem
  itemIndex: number
  itemOffsetMs: number
  cycleOffsetMs: number
  totalDurationMs: number
}

export function getCalibratedNow(clientNowMs: number, clockOffsetMs: number) {
  return clientNowMs + clockOffsetMs
}

export function resolveLivePosition(status: LiveStatus, clientNowMs: number): LivePosition | null {
  const items = status.items ?? []
  const publishedAtMs = Date.parse(status.publishedAt ?? '')
  const totalDurationMs = items.reduce((total, item) => total + item.durationMs, 0)

  if (
    status.status !== 'live'
    || status.versionId === undefined
    || items.length === 0
    || !Number.isFinite(publishedAtMs)
    || items.some((item) => !Number.isFinite(item.durationMs) || item.durationMs <= 0)
    || totalDurationMs <= 0
  ) {
    return null
  }

  const elapsedMs = Math.max(0, clientNowMs - publishedAtMs)
  const cycleOffsetMs = elapsedMs % totalDurationMs
  let itemStartMs = 0

  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex]
    if (cycleOffsetMs < itemStartMs + item.durationMs) {
      return {
        versionId: status.versionId,
        item,
        itemIndex,
        itemOffsetMs: cycleOffsetMs - itemStartMs,
        cycleOffsetMs,
        totalDurationMs,
      }
    }
    itemStartMs += item.durationMs
  }

  return null
}
