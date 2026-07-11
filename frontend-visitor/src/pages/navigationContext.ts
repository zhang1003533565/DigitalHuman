export type NavigationContext = {
  routeId: string
  spotId: string
  spotName: string
  sessionId: string
  traceId: string
  messageId?: number
}

type CachedTripPlan = {
  route: { id: string; name?: string } | null
}

type TripPlanCacheEnvelope = { version: 1; savedAt: number; plan: CachedTripPlan }
const TRIP_PLAN_TTL_MS = 30 * 60 * 1000

function clean(value: string | null) {
  return value?.trim() ?? ''
}

export function parseNavigationContext(search: string): NavigationContext {
  const params = new URLSearchParams(search)
  const rawMessageId = clean(params.get('messageId'))
  const messageId = /^\d+$/.test(rawMessageId) ? Number(rawMessageId) : undefined
  return {
    routeId: clean(params.get('routeId')) || clean(params.get('route')) || clean(params.get('plan')),
    spotId: clean(params.get('spotId')),
    spotName: clean(params.get('spotName')) || clean(params.get('spot')),
    sessionId: clean(params.get('sessionId')),
    traceId: clean(params.get('traceId')),
    messageId: messageId !== undefined && Number.isSafeInteger(messageId) ? messageId : undefined,
  }
}

export function createTripPlanCache(plan: CachedTripPlan, savedAt = Date.now()) {
  return JSON.stringify({ version: 1, savedAt, plan } satisfies TripPlanCacheEnvelope)
}

export function readTripPlan(raw: string | null, now = Date.now()): CachedTripPlan | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as CachedTripPlan | TripPlanCacheEnvelope | null
    if (!parsed || typeof parsed !== 'object') return null
    const plan = 'version' in parsed
      ? parsed.version === 1 && Number.isFinite(parsed.savedAt) && now - parsed.savedAt <= TRIP_PLAN_TTL_MS
        ? parsed.plan
        : null
      : parsed
    return plan?.route && typeof plan.route.id === 'string' && plan.route.id.trim() ? plan : null
  } catch {
    return null
  }
}

export function resolveRouteId(search: string, cachedPlan: string | null) {
  return parseNavigationContext(search).routeId || readTripPlan(cachedPlan)?.route?.id || ''
}
