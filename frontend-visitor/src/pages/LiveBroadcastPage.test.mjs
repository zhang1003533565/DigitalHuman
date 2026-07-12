import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')
const page = read('./LiveBroadcastPage.tsx')
const css = read('./LiveBroadcastPage.css')
const app = read('../App.tsx')

assert.match(app, /path="\/live"[\s\S]*<LiveBroadcastPage/)
assert.match(app, /<Route element=\{<ProtectedRoute/)
assert.match(page, /getLiveStatus\(\{ signal:/)
assert.match(page, /resolveCurrentLivePosition\(snapshot,/)
assert.doesNotMatch(page, /resolveLivePosition\([^,]+,\s*Date\.now\(\)/)
assert.match(page, /visibilitychange/)
assert.match(page, /syncLiveStatus\('visibility-resume'\)/)
assert.match(page, /stopPlayback\(\)[\s\S]*setPhase\('asking'\)/)
assert.match(page, /syncLiveStatus\('answer-complete'\)/)
assert.doesNotMatch(page, /setCurrentItemIndex\(/)
assert.match(page, /versionRef\.current !== snapshot\.versionId[\s\S]*stopPlayback\(\)/)
assert.match(page, /AbortController/)
assert.match(page, /直播内容准备中/)
assert.match(page, /停止本地回答/)
assert.match(page, /语音提问/)
assert.match(css, /\.live-broadcast-page\s*\{[^}]*touch-action:\s*pan-y/s)
assert.match(css, /\.live-stage__canvas\s*\{[^}]*touch-action:\s*none/s)
assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.live-broadcast-page__body\s*\{[^}]*grid-template-columns:\s*1fr/s)
assert.match(css, /padding-bottom:\s*calc\(var\(--mobile-nav-height\) \+ var\(--safe-bottom\) \+ 16px\)/)

console.log('live broadcast page contract passed')
