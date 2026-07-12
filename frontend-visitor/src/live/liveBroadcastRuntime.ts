export type LiveGuideStreamEvent = {
  token?: string
  sessionId?: string
}

export function parseLiveGuideStreamData(raw: string): LiveGuideStreamEvent | null {
  if (!raw || raw === '[DONE]') return null
  const data = JSON.parse(raw) as { token?: unknown; sessionId?: unknown; error?: unknown }
  if (data.error) throw new Error(String(data.error))
  return {
    token: typeof data.token === 'string' ? data.token : undefined,
    sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
  }
}

export function createLiveSpeechKey(versionId: number, itemId: number, generation: number) {
  return `${generation}:${versionId}:${itemId}`
}

export function shouldSkipBackgroundLiveSync(reason: string, hasInteraction: boolean, activeSyncReason: string | null) {
  const isBackgroundSync = reason === 'poll' || reason === 'visibility-resume'
  return isBackgroundSync && (hasInteraction || activeSyncReason !== null)
}

export function shouldRecoverLiveSpeechAfterSyncFailure(reason: string, hasLiveSnapshot: boolean) {
  return reason === 'answer-complete' && hasLiveSnapshot
}
