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

export function resolveLivePosition(status: LiveStatus, calibratedNowMs: number): LivePosition | null {
  const items = status.items ?? []
  const publishedAtMs = Date.parse(status.publishedAt ?? '')

  if (
    status.status !== 'live'
    || status.versionId === undefined
    || items.length === 0
    || !Number.isFinite(publishedAtMs)
    || !Number.isSafeInteger(publishedAtMs)
    || !Number.isFinite(calibratedNowMs)
    || !Number.isSafeInteger(calibratedNowMs)
    || !Number.isFinite(status.totalDurationMs)
    || !Number.isSafeInteger(status.totalDurationMs)
    || (status.totalDurationMs ?? 0) <= 0
  ) {
    return null
  }

  let totalDurationMs = 0
  for (const item of items) {
    if (!Number.isFinite(item.durationMs) || !Number.isSafeInteger(item.durationMs) || item.durationMs <= 0) {
      return null
    }
    if (totalDurationMs > Number.MAX_SAFE_INTEGER - item.durationMs) {
      return null
    }
    totalDurationMs += item.durationMs
  }
  if (totalDurationMs !== status.totalDurationMs) {
    return null
  }

  const rawElapsedMs = calibratedNowMs - publishedAtMs
  if (!Number.isSafeInteger(rawElapsedMs)) {
    return null
  }
  const elapsedMs = Math.max(0, rawElapsedMs)
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

export function resolveCurrentLivePosition(
  status: LiveStatus & { clockOffsetMs: number },
  clientNowMs: number,
): LivePosition | null {
  return resolveLivePosition(status, getCalibratedNow(clientNowMs, status.clockOffsetMs))
}
