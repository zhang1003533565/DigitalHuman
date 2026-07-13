export type MobileMapDrawerState = 'collapsed' | 'expanded'
export type MobileMapLiveStatus = 'loading' | 'live' | 'ready' | 'error'

export function toggleMobileMapDrawer(state: MobileMapDrawerState): MobileMapDrawerState {
  return state === 'expanded' ? 'collapsed' : 'expanded'
}

export function getMobileMapLiveLabel(status: MobileMapLiveStatus) {
  if (status === 'live') return '在线'
  if (status === 'error') return '同步失败'
  return '准备中'
}

export function shouldShowMobileMapClearAction(keyword: string, resultCount: number) {
  return keyword.trim().length > 0 || resultCount > 0
}
