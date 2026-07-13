import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./HistoryPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./HistoryPage.css', import.meta.url), 'utf8')

assert.match(page, /const \[loadState, setLoadState\] = useState<'idle' \| 'loading' \| 'error'>\('idle'\)/)
assert.match(page, /const \[reloadKey, setReloadKey\] = useState\(0\)/)
assert.match(page, /new AbortController\(\)/)
assert.match(page, /signal:\s*controller\.signal/)
assert.match(page, /className="history-mobile-head"/)
assert.match(page, /className="history-timeline"/)
assert.match(page, /history-message--\$\{message\.role === 'user' \? 'user' : 'assistant'\}/)
assert.match(page, /会话记录加载失败[\s\S]*重试/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.history-page\s*\{[^}]*--personal-mobile-edge:\s*14px/)
assert.match(css, /\.authenticated-app__content:has\(> \.history-page\)\s*\{[^}]*overflow-y:\s*auto/)
assert.match(css, /\.history-message__body\s*\{[^}]*overflow-wrap:\s*anywhere/)

console.log('history mobile timeline contract checks passed')
