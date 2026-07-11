export type TripPlanRequest = {
  interest: string
  durationHours?: number
  intensity?: string
  groupType?: string
}

export type TripPlanResponse = {
  route: {
    id: string
    name: string
    suitableFor: string
    duration: string
    distance: string
    intensity: string
    reason: string
    bestTime: string
    sortOrder: number
    enabled: boolean
    tags: string[]
    spots: string[]
  } | null
  score: number
  reasons: string[]
  reminders: string[]
  fallbackUsed: boolean
}

export type GuideChatResult = {
  sessionId: string
  traceId: string
  answerText: string
  relatedSpots: string[]
  recommendedRoutes: string[]
  suggestions: string[]
  sources: Array<{ title: string; content: string }>
}

export type ApiProblem = {
  status?: number
  code?: string
  message: string
  traceId?: string
}

export function buildTripPlanSearchParams(input: TripPlanRequest) {
  const params = new URLSearchParams()

  Object.entries(input).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  })

  return params
}

export function normalizeGuideChatResult(input: Partial<GuideChatResult>): GuideChatResult {
  return {
    sessionId: input.sessionId ?? '',
    traceId: input.traceId ?? '',
    answerText: input.answerText ?? '',
    relatedSpots: input.relatedSpots ?? [],
    recommendedRoutes: input.recommendedRoutes ?? [],
    suggestions: input.suggestions ?? [],
    sources: input.sources ?? [],
  }
}
