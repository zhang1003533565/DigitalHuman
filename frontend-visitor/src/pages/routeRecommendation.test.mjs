import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const compiledModule = new URL('../../node_modules/.tmp/route-recommendation-test/routeRecommendation.js', import.meta.url)
const pageSourceUrl = new URL('./RouteRecommendPage.tsx', import.meta.url)

const readExportedConst = async (name) => {
  const source = await readFile(pageSourceUrl, 'utf8')
  const start = source.indexOf(`const ${name} =`)
  assert.notEqual(start, -1, `${name} helper must exist in RouteRecommendPage.tsx`)
  const afterStart = source.slice(start)
  const boundaries = ['\n\nconst ', '\n\nfunction ', '\n\nexport ', '\n\nexport function ']
    .map((token) => afterStart.indexOf(token))
    .filter((index) => index > 0)
  const finalEnd = boundaries.length ? Math.min(...boundaries) : afterStart.length
  return afterStart.slice(0, finalEnd).trim()
}

const instantiateExportedConst = async (name, dependencies = {}) => {
  const helperSource = await readExportedConst(name)
  const expression = helperSource
    .replace(new RegExp(`^const ${name} =\\s*`), '')
    .replace(/\}\s*:\s*[A-Za-z0-9_<>{}\[\]\s|,]+\)\s*=>/g, '}) =>')
    .replace(/\(([A-Za-z0-9_]+)\s*:\s*[A-Za-z0-9_<>{}\[\]\s|,]+/g, '($1')
  const dependencyNames = Object.keys(dependencies)
  const factory = new Function(...dependencyNames, `return (${expression})`)
  return factory(...dependencyNames.map((key) => dependencies[key]))
}

const baseCoordinate = { longitude: 120.1, latitude: 31.4 }

function route(overrides) {
  return {
    id: overrides.id,
    name: overrides.name,
    suitableFor: overrides.suitableFor,
    duration: overrides.duration,
    distance: overrides.distance,
    intensity: overrides.intensity,
    reason: overrides.reason,
    bestTime: '09:00入园最佳',
    tags: overrides.tags,
    spots: [],
    nodes: overrides.nodes,
    facilities: overrides.facilities,
    polyline: [],
  }
}

test('route recommendations explain rank, fit, tradeoff, and route highlights', async () => {
  const { buildRouteRecommendations, buildVisitorRouteSummary } = await import(compiledModule.href)
  const recommendations = buildRouteRecommendations([
    route({
      id: 'culture',
      name: '历史文化爱好者路线',
      suitableFor: '历史文化 · 深度探索',
      duration: '6小时',
      distance: '约3.8公里',
      intensity: '深度步行',
      reason: '覆盖祥符禅寺、灵山大佛、梵宫等核心文化节点。',
      tags: ['历史文化', '深度讲解'],
      nodes: [
        { id: 'a', name: '南门入园', type: 'gate', stay: '5分钟', summary: '完成检票。', required: true, coordinate: baseCoordinate },
        { id: 'b', name: '灵山大佛', type: 'spot', stay: '60分钟', summary: '核心文化景观。', required: true, coordinate: baseCoordinate },
        { id: 'c', name: '梵宫', type: 'spot', stay: '75分钟', summary: '适合深度参观。', required: true, coordinate: baseCoordinate },
      ],
      facilities: [
        { id: 'service', name: '游客中心', category: 'service', nearNode: '南门入园', distance: '约120米', coordinate: baseCoordinate },
      ],
    }),
    route({
      id: 'family',
      name: '亲子家庭路线',
      suitableFor: '亲子家庭 · 轻松游览',
      duration: '4小时',
      distance: '约2.4公里',
      intensity: '轻松步行',
      reason: '停留点更短，休息点更多。',
      tags: ['亲子友好', '轻松'],
      nodes: [
        { id: 'd', name: '亲水平台', type: 'spot', stay: '30分钟', summary: '适合孩子休息。', required: true, coordinate: baseCoordinate },
      ],
      facilities: [],
    }),
  ], {
    interest: '历史文化',
    duration: '6',
    intensity: '深度',
  }, 'culture')

  assert.equal(recommendations[0].id, 'culture')
  assert.equal(recommendations[0].rankLabel, '最推荐')
  assert.ok(recommendations[0].score > recommendations[1].score)
  assert.match(recommendations[0].matchReason, /历史文化/)
  assert.match(recommendations[0].tradeoff, /深度|完整|时间/)
  assert.ok(recommendations[0].highlights.length >= 3)
  assert.match(recommendations[0].highlights.join(' '), /灵山大佛|梵宫/)
  assert.equal(recommendations[1].rankLabel, '备选 1')

  const summary = buildVisitorRouteSummary(recommendations[0], 0)
  assert.deepEqual(Object.keys(summary), [
    'badge',
    'audience',
    'description',
    'majorStops',
    'travelTip',
  ])
  assert.equal(summary.badge, '推荐')
  assert.equal(summary.description, recommendations[0].reason)
  assert.equal(summary.audience, '历史文化，深度探索')
  assert.deepEqual(summary.majorStops, ['南门入园', '灵山大佛', '梵宫'])
  assert.match(summary.audience, /历史文化|深度探索/)
  assert.match(summary.travelTip, /舒适的鞋|体力|时间/)
  assert.doesNotMatch(JSON.stringify(summary), /78|分匹配|选择取舍|Route Value/)
})

test('visitor route summary marks non-primary routes as fallback without leaking internal ranking text', async () => {
  const { buildRouteRecommendations, buildVisitorRouteSummary } = await import(compiledModule.href)
  const recommendations = buildRouteRecommendations([
    route({
      id: 'culture',
      name: '历史文化爱好者路线',
      suitableFor: '历史文化 · 深度探索',
      duration: '6小时',
      distance: '约3.8公里',
      intensity: '深度步行',
      reason: '覆盖祥符禅寺、灵山大佛、梵宫等核心文化节点。',
      tags: ['历史文化', '深度讲解'],
      nodes: [
        { id: 'a', name: '南门入园', type: 'gate', stay: '5分钟', summary: '完成检票。', required: true, coordinate: baseCoordinate },
      ],
      facilities: [],
    }),
    route({
      id: 'balanced',
      name: '均衡游览路线',
      suitableFor: '经典打卡 · 从容游览',
      duration: '5小时',
      distance: '约3公里',
      intensity: '标准步行',
      reason: '串联核心景点与休息区，适合第一次到访。',
      tags: ['经典路线'],
      nodes: [
        { id: 'b', name: '佛手广场', type: 'spot', stay: '20分钟', summary: '适合停留拍照。', required: true, coordinate: baseCoordinate },
      ],
      facilities: [],
    }),
  ], {
    interest: '历史文化',
    duration: '6',
    intensity: '深度',
  }, 'culture')

  const summary = buildVisitorRouteSummary(recommendations[1], 1)
  assert.equal(summary.badge, '备选')
  assert.doesNotMatch(JSON.stringify(summary), /最推荐|备选 1|score|matchReason|tradeoff|highlights|Route Value/)
})

test('visitor route summary uses rest-stop travel tip for easy or family-friendly routes', async () => {
  const { buildVisitorRouteSummary } = await import(compiledModule.href)

  const easySummary = buildVisitorRouteSummary({
    ...route({
      id: 'easy',
      name: '轻松漫游路线',
      suitableFor: '好友出行 · 轻松游览',
      duration: '4小时',
      distance: '约2公里',
      intensity: '轻松步行',
      reason: '沿途节奏平缓，补给点较多。',
      tags: ['轻松'],
      nodes: [],
      facilities: [],
    }),
    rankLabel: '最推荐',
    score: 78,
    matchReason: '匹配你的轻松需求',
    tradeoff: '减少深度节点',
    highlights: [],
  }, 0)

  const familySummary = buildVisitorRouteSummary({
    ...route({
      id: 'family',
      name: '亲子家庭路线',
      suitableFor: '亲子家庭 · 经典游览',
      duration: '4小时',
      distance: '约2.4公里',
      intensity: '标准步行',
      reason: '照顾亲子休息与观景节奏。',
      tags: ['亲子友好'],
      nodes: [],
      facilities: [],
    }),
    rankLabel: '备选 1',
    score: 66,
    matchReason: '匹配你的亲子偏好',
    tradeoff: '减少部分深度文化节点',
    highlights: [],
  }, 1)

  assert.match(easySummary.travelTip, /途中休息/)
  assert.match(familySummary.travelTip, /途中休息/)
  assert.doesNotMatch(JSON.stringify(easySummary), /78|分匹配|选择取舍|Route Value/)
  assert.doesNotMatch(JSON.stringify(familySummary), /66|分匹配|选择取舍|Route Value/)
})

test('visitor route summary falls back to flexible opening-hours tip for standard intensity routes', async () => {
  const { buildVisitorRouteSummary } = await import(compiledModule.href)
  const summary = buildVisitorRouteSummary({
    ...route({
      id: 'standard',
      name: '均衡游览路线',
      suitableFor: '经典打卡 · 从容游览',
      duration: '5小时',
      distance: '约3公里',
      intensity: '标准步行',
      reason: '景点节奏均衡，适合首次到访。',
      tags: ['经典路线'],
      nodes: [],
      facilities: [],
    }),
    rankLabel: '备选 1',
    score: 64,
    matchReason: '匹配你的经典路线偏好',
    tradeoff: '在观景和参观深度之间折中',
    highlights: [],
  }, 1)

  assert.match(summary.travelTip, /开放时间|灵活调整/)
  assert.doesNotMatch(JSON.stringify(summary), /64|分匹配|选择取舍|Route Value/)
})

test('visitor route summary keeps majorStops empty when nodes are missing or not required', async () => {
  const { buildVisitorRouteSummary } = await import(compiledModule.href)

  const missingNodesSummary = buildVisitorRouteSummary({
    ...route({
      id: 'missing-nodes',
      name: '缺省节点路线',
      suitableFor: '轻松散步',
      duration: '3小时',
      distance: '约1.5公里',
      intensity: '标准步行',
      reason: '适合临时起意的快速游览。',
      tags: [],
      nodes: undefined,
      facilities: [],
    }),
    rankLabel: '备选 1',
    score: 61,
    matchReason: '匹配你的临时游览偏好',
    tradeoff: '减少深度节点',
    highlights: [],
  }, 1)

  const optionalNodesSummary = buildVisitorRouteSummary({
    ...route({
      id: 'optional-nodes',
      name: '可选节点路线',
      suitableFor: '好友出行',
      duration: '3小时',
      distance: '约1.8公里',
      intensity: '标准步行',
      reason: '适合按当日状态灵活安排。',
      tags: [],
      nodes: [
        { id: 'optional-a', name: '观景平台', type: 'spot', stay: '15分钟', summary: '可短暂停留。', required: false, coordinate: baseCoordinate },
      ],
      facilities: [],
    }),
    rankLabel: '备选 2',
    score: 59,
    matchReason: '匹配你的灵活偏好',
    tradeoff: '需要自行取舍停留点',
    highlights: [],
  }, 2)

  assert.deepEqual(missingNodesSummary.majorStops, [])
  assert.deepEqual(optionalNodesSummary.majorStops, [])
  assert.doesNotMatch(JSON.stringify(missingNodesSummary), /61|分匹配|选择取舍|Route Value/)
  assert.doesNotMatch(JSON.stringify(optionalNodesSummary), /59|分匹配|选择取舍|Route Value/)
})

test('route page renders visitor-first route selection flow', async () => {
  const source = await readFile(pageSourceUrl, 'utf8')

  for (const copy of [
    '今天想怎么玩？',
    '查看行程',
    '在景区地图中打开',
    '清除筛选',
    '重新加载路线',
    '餐饮',
    '卫生间',
    '服务点',
  ]) {
    assert.match(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  for (const removedCopy of ['Route Planner', 'Route Value', '分匹配', '推荐理由：', '选择取舍：']) {
    assert.doesNotMatch(source, new RegExp(removedCopy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.match(source, /buildVisitorRouteSummary/)
  assert.match(source, /aria-pressed=\{selectedRoute\?\.id === route\.id\}/)
  assert.match(source, /setFilters\(\{ interest: '', duration: '', intensity: '' \}\)/)
  assert.match(source, /visibleFacilityGroups/)
  assert.match(source, /useVisitorTheme\(\)/)
  assert.match(source, /useLayoutEffect\(\(\) => \{\s*mapThemeControllerRef\.current\.setTheme\(effectiveTheme\)/)
  assert.match(source, /createVisitorMapThemeController/)
  assert.match(source, /mapThemeControllerRef\.current\.syncMapStyle\(\)/)
})

test('selection helper keeps the previous route id through empty results and restores it when available again', async () => {
  const reconcileSelectedRouteId = await instantiateExportedConst('reconcileSelectedRouteId')

  assert.equal(
    reconcileSelectedRouteId({
      visibleRouteIds: [],
      currentSelectedRouteId: 'route-b',
      cachedRouteId: 'route-a',
    }),
    'route-b',
  )
  assert.equal(
    reconcileSelectedRouteId({
      visibleRouteIds: ['route-a', 'route-b'],
      currentSelectedRouteId: 'route-b',
      cachedRouteId: 'route-a',
    }),
    'route-b',
  )
  assert.equal(
    reconcileSelectedRouteId({
      visibleRouteIds: ['route-a', 'route-c'],
      currentSelectedRouteId: 'route-b',
      cachedRouteId: 'route-c',
    }),
    'route-c',
  )
  assert.equal(
    reconcileSelectedRouteId({
      visibleRouteIds: ['route-a', 'route-c'],
      currentSelectedRouteId: 'route-b',
      cachedRouteId: 'missing',
    }),
    'route-a',
  )
})

test('request gate ignores stale route successes and stale route failures', async () => {
  const createRouteRequestGate = await instantiateExportedConst('createRouteRequestGate')
  const gate = createRouteRequestGate()

  const firstRequestId = gate.begin()
  const secondRequestId = gate.begin()

  assert.equal(gate.isCurrent(firstRequestId), false, 'older success payloads must be ignored after a newer request begins')
  assert.equal(gate.isCurrent(secondRequestId), true, 'latest success payload may update the page')

  const thirdRequestId = gate.begin()
  assert.equal(gate.isCurrent(secondRequestId), false, 'older errors must be ignored after retry starts a newer request')
  assert.equal(gate.isCurrent(thirdRequestId), true, 'latest retry result remains eligible to update the page')
})

test('route map initializes after async route content mounts when AMap is already cached', async () => {
  const source = await readFile(pageSourceUrl, 'utf8')

  assert.match(
    source,
    /useEffect\(\(\) => \{[\s\S]*new amapApi\.Map\(mapContainerRef\.current,[\s\S]*\}, \[amapApi, selectedRoute\]\)/,
    'map initialization must retry when the selected route renders the map container after the cached SDK resolves',
  )
})
