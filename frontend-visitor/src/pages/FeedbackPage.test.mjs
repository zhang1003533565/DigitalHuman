import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const feedback = readFileSync(new URL('./FeedbackPage.tsx', import.meta.url), 'utf8')
const cards = readFileSync(new URL('../components/GuideResultCards.tsx', import.meta.url), 'utf8')

assert.match(feedback, /digitalhuman\.visitor\.guideSessionId/)
assert.match(feedback, /if \(!sessionId\)/)
assert.match(feedback, /\/api\/user\/guide\/feedback/)
assert.match(feedback, /params: \{ sessionId \}/)
assert.match(feedback, /正在加载反馈记录/)
assert.match(feedback, /反馈记录加载失败/)
assert.match(feedback, />重试</)
assert.doesNotMatch(feedback, /axios\.get<FeedbackRecord\[]>\('\/api\/guide\/feedback'/)
assert.match(cards, /routeId: route/)
assert.match(cards, /查看推荐路线/)

console.log('feedback session scoping and route navigation checks passed')
