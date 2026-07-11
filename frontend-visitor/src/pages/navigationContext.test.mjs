import assert from 'node:assert/strict'
import { parseNavigationContext, readTripPlan, resolveRouteId } from '../../node_modules/.tmp/navigation-test/navigationContext.js'

const context = parseNavigationContext('?routeId=route-3&spotId=spot-8&sessionId=session-2&traceId=trace-9')
assert.deepEqual(context, {
  routeId: 'route-3', spotId: 'spot-8', spotName: '', sessionId: 'session-2', traceId: 'trace-9',
})

assert.equal(parseNavigationContext('?route=旧路线&spot=旧景点').routeId, '旧路线')
assert.equal(parseNavigationContext('?route=旧路线&spot=旧景点').spotName, '旧景点')
assert.equal(parseNavigationContext('?routeId=%20').routeId, '')

assert.equal(readTripPlan('{bad json'), null)
assert.equal(readTripPlan(JSON.stringify({ route: { id: 'cached-route', name: '缓存路线' } }))?.route?.id, 'cached-route')
assert.equal(readTripPlan(JSON.stringify({ route: { name: '缺少编号' } })), null)

assert.equal(resolveRouteId('?routeId=query-route', JSON.stringify({ route: { id: 'cached-route' } })), 'query-route')
assert.equal(resolveRouteId('', JSON.stringify({ route: { id: 'cached-route' } })), 'cached-route')

console.log('navigation context tests passed')
