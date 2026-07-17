export type Coordinate = {
  longitude: number
  latitude: number
}

export type RouteNode = {
  id: string
  name: string
  type: string
  stay: string
  summary: string
  required: boolean
  coordinate: Coordinate
}

export type RouteFacility = {
  id: string
  name: string
  category: string
  nearNode: string
  distance: string
  coordinate: Coordinate
}

export type ScenicRoute = {
  id: string
  name: string
  suitableFor: string
  duration: string
  distance: string
  intensity: string
  reason: string
  bestTime: string
  tags: string[]
  spots: string[]
  nodes: RouteNode[]
  facilities: RouteFacility[]
  polyline: Coordinate[]
}

export type RouteFilters = {
  interest: string
  duration: string
  intensity: string
}

export type RouteRecommendation = ScenicRoute & {
  rankLabel: string
  score: number
  matchReason: string
  tradeoff: string
  highlights: string[]
}

function textIncludes(value: string, expected: string) {
  return Boolean(expected) && value.includes(expected)
}

function routeText(route: ScenicRoute) {
  return [
    route.name,
    route.suitableFor,
    route.reason,
    route.intensity,
    ...(route.tags ?? []),
    ...(route.nodes ?? []).map((node) => `${node.name}${node.summary}`),
  ].join(' ')
}

function buildScore(route: ScenicRoute, filters: RouteFilters, preferredRouteId: string) {
  const haystack = routeText(route)
  let score = 60

  if (route.id === preferredRouteId) score += 10
  if (textIncludes(haystack, filters.interest)) score += 18
  if (filters.duration && route.duration.includes(filters.duration)) score += 12
  if (filters.intensity && route.intensity.includes(filters.intensity)) score += 12
  score += Math.min((route.nodes ?? []).filter((node) => node.required).length * 2, 10)
  score += Math.min((route.facilities ?? []).length * 2, 8)

  return Math.min(score, 100)
}

function buildRankLabel(index: number) {
  return index === 0 ? '最推荐' : `备选 ${index}`
}

function buildMatchReason(route: ScenicRoute, filters: RouteFilters) {
  const matches = [
    filters.interest ? `兴趣偏好“${filters.interest}”` : '',
    filters.duration ? `游玩时长约 ${filters.duration} 小时` : '',
    filters.intensity ? `步行强度“${filters.intensity}”` : '',
  ].filter(Boolean)

  if (matches.length) {
    return `匹配你的${matches.join('、')}，${route.reason}`
  }

  return `${route.reason} 这条路线节点完整，适合作为默认推荐。`
}

function buildTradeoff(route: ScenicRoute) {
  if (route.intensity.includes('深度')) {
    return `获得更完整的核心体验，但需要预留 ${route.duration} 和更充足体力。`
  }
  if (route.intensity.includes('轻松') || route.suitableFor.includes('亲子')) {
    return '步行压力更低、休息节奏更友好，但会减少部分深度文化节点。'
  }
  return '路线节奏更均衡，适合在观景和参观深度之间做折中。'
}

function buildHighlights(route: ScenicRoute) {
  const requiredNodes = (route.nodes ?? []).filter((node) => node.required)
  const namedNodes = requiredNodes.length ? requiredNodes : route.nodes ?? []
  const firstNodes = namedNodes.slice(0, 3).map((node) => `${node.name}：${node.summary}`)
  const facilityHighlight = route.facilities?.[0]
    ? `沿途有${route.facilities[0].name}，靠近${route.facilities[0].nearNode}`
    : `建议按 ${route.bestTime} 开始游览`

  return [...firstNodes, facilityHighlight].slice(0, 4)
}

export function buildRouteRecommendations(
  routes: ScenicRoute[],
  filters: RouteFilters,
  preferredRouteId = '',
): RouteRecommendation[] {
  return routes
    .map((route) => ({
      ...route,
      score: buildScore(route, filters, preferredRouteId),
      rankLabel: '',
      matchReason: buildMatchReason(route, filters),
      tradeoff: buildTradeoff(route),
      highlights: buildHighlights(route),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'zh-Hans-CN'))
    .map((route, index) => ({
      ...route,
      rankLabel: buildRankLabel(index),
    }))
}
