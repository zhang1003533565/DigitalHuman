import assert from 'node:assert/strict'
import { buildGuideNavigationSearchParams, buildTripPlanSearchParams, normalizeGuideChatResult } from '../../node_modules/.tmp/contracts-test/contracts.js'

assert.equal(buildTripPlanSearchParams({ interest: '亲子家庭', durationHours: 4, intensity: '轻松少走', groupType: 'family' }).toString(), 'interest=%E4%BA%B2%E5%AD%90%E5%AE%B6%E5%BA%AD&durationHours=4&intensity=%E8%BD%BB%E6%9D%BE%E5%B0%91%E8%B5%B0&groupType=family')
assert.deepEqual(normalizeGuideChatResult({ answerText: '你好', relatedSpots: ['灵山大佛'], recommendedRoutes: ['route-1'] }).suggestions, [])
assert.deepEqual(normalizeGuideChatResult({ answerText: '欢迎', suggestions: ['附近有什么？'] }).suggestions, ['附近有什么？'])
const resultFromFinalStreamMeta = normalizeGuideChatResult({ sessionId: 'session-1', traceId: 'trace-1', messageId: 42 })
assert.equal(resultFromFinalStreamMeta.messageId, 42)
assert.match(buildGuideNavigationSearchParams(resultFromFinalStreamMeta, { routeId: 'route-3' }).toString(), /messageId=42/)
