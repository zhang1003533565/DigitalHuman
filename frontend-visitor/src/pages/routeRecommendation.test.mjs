import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const compiledModule = new URL('../../node_modules/.tmp/route-recommendation-test/routeRecommendation.js', import.meta.url)
const pageSourceUrl = new URL('./RouteRecommendPage.tsx', import.meta.url)

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
  const { buildRouteRecommendations } = await import(compiledModule.href)
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
})

test('route page renders recommendation-first decision hooks', async () => {
  const source = await readFile(pageSourceUrl, 'utf8')

  for (const copy of [
    '为你推荐',
    '推荐理由',
    '选择取舍',
    '路线亮点',
    'route-map-schematic',
    'buildRouteRecommendations',
  ]) {
    assert.match(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.doesNotMatch(source, /Selected Route/)
})
