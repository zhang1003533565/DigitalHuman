import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const componentUrl = new URL('./VisitorTopNav.tsx', import.meta.url)
const cssUrl = new URL('./VisitorTopNav.css', import.meta.url)
const source = readFileSync(fileURLToPath(componentUrl), 'utf8')
const css = readFileSync(fileURLToPath(cssUrl), 'utf8')

const expectedItems = [
  ['/home', '首页'],
  ['/modules/digital-human', 'AI 导览'],
  ['/routes', '路线推荐'],
  ['/map', '景点地图'],
  ['/tips', '游览贴士'],
  ['/feedback', '反馈记录'],
  ['/history', '会话历史'],
]

assert.match(source, /export function VisitorTopNav/)
assert.match(source, /type VisitorTopNavProps = \{ onLogout: \(\) => void \}/)
assert.match(source, /灵山智游/)
assert.match(source, /getStoredUser\(\)/)
assert.match(source, /<NavLink/)

for (const [path, label] of expectedItems) {
  assert.ok(source.includes(`to: '${path}'`) || (path === '/modules/digital-human' && source.includes('to: DIGITAL_HUMAN_ROUTE')))
  assert.ok(source.includes(`label: '${label}'`))
}

assert.doesNotMatch(source, /variant|items\?|title\?/)
assert.match(css, /min-height:\s*64px/)
assert.match(css, /"Songti SC"/)
assert.match(css, /background:\s*#e2ad4b/)
assert.match(css, /\.page-shell > \.visitor-topbar/)
assert.match(css, /\.module-screen > \.visitor-topbar/)
assert.match(css, /@media \(max-width: 768px\)/)
assert.doesNotMatch(css, /--home/)

console.log('VisitorTopNav contract passed')
