export type MobileMapDrawerState = 'collapsed' | 'expanded'
export type MobileMapLiveStatus = 'loading' | 'live' | 'ready' | 'error'

export const MOBILE_MAP_WORKBENCH_MEDIA_QUERY = '(max-width: 768px), (max-width: 932px) and (max-height: 520px) and (orientation: landscape)'

export function toggleMobileMapDrawer(state: MobileMapDrawerState): MobileMapDrawerState {
  return state === 'expanded' ? 'collapsed' : 'expanded'
}

export function getMobileMapLiveLabel(status: MobileMapLiveStatus) {
  if (status === 'live') return '在线'
  if (status === 'error') return '同步失败'
  return '准备中'
}

export function shouldShowMobileMapClearAction(resultCount: number) {
  return resultCount > 0
}

type InertTarget = { inert: boolean }

export function isolateMobileMapDialogBackground(targets: InertTarget[]) {
  const previousStates = targets.map((target) => target.inert)
  targets.forEach((target) => { target.inert = true })

  return () => {
    targets.forEach((target, index) => { target.inert = previousStates[index] })
  }
}

type MobileMapMediaQuery = {
  matches: boolean
  addEventListener: (type: 'change', listener: (event: { matches: boolean }) => void) => void
  removeEventListener: (type: 'change', listener: (event: { matches: boolean }) => void) => void
}

export function watchMobileMapWorkbenchViewport(mediaQuery: MobileMapMediaQuery, onExit: () => void) {
  const handleChange = (event: { matches: boolean }) => {
    if (!event.matches) onExit()
  }

  mediaQuery.addEventListener('change', handleChange)
  if (!mediaQuery.matches) onExit()

  return () => mediaQuery.removeEventListener('change', handleChange)
}

export function createMobileMapSearchDerivedSelection() {
  let facilityId: number | null = null

  return {
    beginSearch() {
      const shouldClearSelection = facilityId !== null
      facilityId = null
      return shouldClearSelection
    },
    selectLocal(nextFacilityId: number) {
      facilityId = nextFacilityId
    },
    clear() {
      facilityId = null
    },
  }
}

export function createMobileMapSearchGenerationGate() {
  let generation = 0

  return {
    begin() {
      generation += 1
      return generation
    },
    invalidate() {
      generation += 1
    },
    isCurrent(candidate: number) {
      return candidate === generation
    },
  }
}
