export type NavigationContext = {
  routeId: string
  spotId: string
  spotName: string
  sessionId: string
  traceId: string
}

type CachedTripPlan = {
  route: { id: string; name?: string } | null
}

function clean(value: string | null) {
  return value?.trim() ?? ''
}

export function parseNavigationContext(search: string): NavigationContext {
  const params = new URLSearchParams(search)
  return {
    routeId: clean(params.get('routeId')) || clean(params.get('route')) || clean(params.get('plan')),
    spotId: clean(params.get('spotId')),
    spotName: clean(params.get('spotName')) || clean(params.get('spot')),
    sessionId: clean(params.get('sessionId')),
    traceId: clean(params.get('traceId')),
  }
}

export function readTripPlan(raw: string | null): CachedTripPlan | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedTripPlan
    return parsed?.route && typeof parsed.route.id === 'string' && parsed.route.id.trim() ? parsed : null
  } catch {
    return null
  }
}

export function resolveRouteId(search: string, cachedPlan: string | null) {
  return parseNavigationContext(search).routeId || readTripPlan(cachedPlan)?.route?.id || ''
}
