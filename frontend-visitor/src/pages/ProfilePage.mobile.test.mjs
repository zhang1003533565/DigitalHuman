import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./ProfilePage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./ProfilePage.css', import.meta.url), 'utf8')

assert.match(page, /className="page-shell profile-page"/)
assert.match(page, /className="profile-identity"/)
assert.match(page, /className="profile-details"/)
assert.match(page, /<dt>用户名<\/dt>/)
assert.match(page, /<dt>显示名称<\/dt>/)
assert.match(page, /<dt>角色<\/dt>/)
assert.match(page, /<section className="profile-stats" aria-label="游客数据">/)
assert.doesNotMatch(page, /className="profile-form__input"/)
assert.doesNotMatch(page, /<input\b/)

assert.match(css, /\.profile-grid\s*\{[^}]*grid-template-columns:\s*280px\s+1fr/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.profile-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
assert.match(css, /\.profile-stat-card\s*\{[^}]*min-height:\s*72px[^}]*max-height:\s*84px/)
assert.match(css, /\.profile-identity\s*\{[^}]*grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\)\s+auto/)
assert.match(css, /\.profile-details dl > div\s*\{[^}]*grid-template-columns:\s*88px\s+minmax\(0,\s*1fr\)/)
assert.match(css, /\.profile-page \.page-content\s*\{[^}]*overflow:\s*visible/)
assert.match(css, /@media \(min-width: 769px\) and \(max-width: 932px\) and \(max-height: 520px\) and \(orientation: landscape\)/)
assert.match(css, /\.authenticated-app__content:has\(> \.profile-page\)\s*\{[^}]*overflow-y:\s*auto/)

const mobile = css.slice(css.indexOf('@media (max-width: 768px)'))
assert.doesNotMatch(mobile, /\.(?:profile-grid|profile-main|profile-stats|profile-details)\s*\{[^}]*(?:overflow-y|overflow):\s*(?:auto|scroll)/s)

console.log('profile mobile identity, statistics, details, and scrolling contracts passed')
