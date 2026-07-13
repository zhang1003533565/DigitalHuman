import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const feedback = readFileSync(new URL('./FeedbackPage.tsx', import.meta.url), 'utf8')
const feedbackCss = readFileSync(new URL('./FeedbackPage.css', import.meta.url), 'utf8')
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
assert.match(feedback, /const \[isComposerOpen, setIsComposerOpen\] = useState\(false\)/)
assert.match(feedback, /const \[expandedRecordKeys, setExpandedRecordKeys\] = useState<Set<string>>\(new Set\(\)\)/)
assert.match(feedback, /setReloadKey\(\(value\) => value \+ 1\)/)
assert.match(feedback, /setIsComposerOpen\(false\)/)
assert.match(feedback, /aria-expanded=\{expandedRecordKeys\.has\(recordKey\)\}/)
assert.match(feedback, /className="feedback-mobile-summary"/)
assert.match(feedback, /className="feedback-composer"/)
assert.match(feedbackCss, /\.feedback-record__summary\s*\{[^}]*min-height:\s*44px/)

console.log('feedback interaction, session scoping, and route navigation checks passed')
