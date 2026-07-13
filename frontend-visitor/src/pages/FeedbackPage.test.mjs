import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const stateSourceUrl = new URL('./feedbackPageState.ts', import.meta.url)
const stateOutputUrl = new URL('../../node_modules/.tmp/feedback-page-test/feedbackPageState.js', import.meta.url)
execFileSync(process.execPath, [
  fileURLToPath(new URL('../../node_modules/typescript/bin/tsc', import.meta.url)),
  fileURLToPath(stateSourceUrl),
  '--ignoreConfig',
  '--outDir',
  fileURLToPath(new URL('../../node_modules/.tmp/feedback-page-test', import.meta.url)),
  '--target',
  'es2023',
  '--module',
  'nodenext',
  '--moduleResolution',
  'nodenext',
  '--skipLibCheck',
])

const {
  applyFeedbackSubmitFailure,
  applyFeedbackSubmitSuccess,
  formatFeedbackTime,
  shouldCommitFeedbackLoad,
  toggleExpandedRecordKey,
} = await import(`${stateOutputUrl.href}?test=${Date.now()}`)

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
assert.match(feedback, /import \{[^}]*applyFeedbackSubmitSuccess[^}]*shouldCommitFeedbackLoad[^}]*\} from '\.\/feedbackPageState'/s)
assert.match(feedback, /type FeedbackRecord = \{\s*id: number/)
assert.match(feedback, /const loadGenerationRef = useRef\(0\)/)
assert.match(feedback, /const controller = new AbortController\(\)/)
assert.match(feedback, /signal: controller\.signal/)
assert.match(feedback, /return \(\) => controller\.abort\(\)/)
assert.equal(feedback.match(/shouldCommitFeedbackLoad\(/g)?.length, 2, 'success and failure responses must share the latest-request gate')
assert.match(feedback, /const response = await axios\.get<FeedbackRecord\[]>[\s\S]*if \(!shouldCommitFeedbackLoad\([^\n]+\)\) return\s*setRecords\(response\.data\)/)
assert.match(feedback, /\} catch \{\s*if \(!shouldCommitFeedbackLoad\([^\n]+\)\) return\s*setLoadState\('error'\)/)
assert.match(feedback, /setExpandedRecordKeys\(\(current\) => toggleExpandedRecordKey\(current, recordKey\)\)/)
assert.match(
  feedback,
  /const next = applyFeedbackSubmitSuccess\([^;]+\)\s*setComment\(next\.comment\)\s*setSubmitState\(next\.submitState\)\s*setIsComposerOpen\(next\.isComposerOpen\)\s*setReloadKey\(/s,
)
assert.match(feedback, /const next = applyFeedbackSubmitFailure\([^;]+\)\s*setSubmitState\(next\.submitState\)/s)
assert.match(feedback, /const recordKey = String\(record\.id\)/)
assert.match(feedback, /key=\{record\.id\}/)
assert.doesNotMatch(feedback, /record\.sessionId\}-\$\{record\.createdAt/)
assert.match(feedback, /<div id=\{bodyId\} className="feedback-record__body" hidden=\{!expandedRecordKeys\.has\(recordKey\)\}>/)
assert.match(feedback, /<time dateTime=\{record\.createdAt\}>\{formatFeedbackTime\(record\.createdAt\)\}<\/time>/)

const submitState = {
  comment: '请保留这条建议',
  submitState: '提交中…',
  isComposerOpen: true,
  reloadKey: 7,
}
assert.deepEqual(applyFeedbackSubmitSuccess(submitState), {
  comment: '',
  submitState: '感谢反馈，已提交。',
  isComposerOpen: false,
  reloadKey: 8,
})
assert.deepEqual(Object.keys(applyFeedbackSubmitSuccess(submitState)), [
  'comment',
  'submitState',
  'isComposerOpen',
  'reloadKey',
])
assert.deepEqual(applyFeedbackSubmitFailure(submitState), {
  ...submitState,
  submitState: '提交失败，请稍后重试。',
})

const firstExpanded = toggleExpandedRecordKey(new Set(), '101')
const twoExpanded = toggleExpandedRecordKey(firstExpanded, '202')
assert.deepEqual([...twoExpanded], ['101', '202'])
assert.deepEqual([...toggleExpandedRecordKey(twoExpanded, '101')], ['202'])
assert.deepEqual([...twoExpanded], ['101', '202'], 'toggle must not mutate the current set')

assert.equal(shouldCommitFeedbackLoad(3, 3, false), true)
assert.equal(shouldCommitFeedbackLoad(3, 2, false), false, 'a stale request must not overwrite the latest response')
assert.equal(shouldCommitFeedbackLoad(3, 3, true), false, 'an aborted request must not update state')
const controller = new AbortController()
assert.equal(shouldCommitFeedbackLoad(4, 4, controller.signal.aborted), true)
controller.abort()
assert.equal(shouldCommitFeedbackLoad(4, 4, controller.signal.aborted), false)
assert.equal(formatFeedbackTime('not-a-date'), '时间未知')
assert.equal(formatFeedbackTime(''), '时间未知')
assert.notEqual(formatFeedbackTime('2026-07-13T20:30:00'), '时间未知')

console.log('feedback executable state, interaction, session scoping, and route navigation checks passed')
