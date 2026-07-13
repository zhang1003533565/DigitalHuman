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
