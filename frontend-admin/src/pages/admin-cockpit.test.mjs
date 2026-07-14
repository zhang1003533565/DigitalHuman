import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

const layout = read('./AdminLayout.tsx')
const sidebar = read('../components/AdminSidebar.tsx')
const topbar = read('../components/AdminTopbar.tsx')
const frame = read('../components/AdminPageFrame.tsx')
const meta = read('../adminPageMeta.ts')
const theme = read('../admin-cockpit.css')
const main = read('../main.tsx')
const app = read('../App.tsx')
const qaPage = read('./QaRecordsPage.tsx')
const qaApi = read('../api/qaRecords.ts')

const requiredMenuKeys = [
  'dashboard', 'home-config', 'spots', 'spot-category', 'facility-list', 'routes',
  'travel-analytics', 'scenic-structured', 'voice-scripts', 'travel-tips', 'avatar',
  'model-emotion', 'feedback', 'live-broadcast', 'qa', 'ai-models', 'knowledge', 'settings',
]

assert.doesNotMatch(main, /admin-cockpit\.css/)
assert.match(app, /App\.css['"][\s\S]*admin-cockpit\.css/, 'cockpit theme must load after legacy styles')
assert.match(layout, /<AdminTopbar/)
assert.match(layout, /<AdminPageFrame/)
assert.match(layout, /getAdminPageMeta\(activeKey\)/)
assert.match(topbar, /实时运行中/)
assert.match(topbar, /景区选择/)
assert.match(frame, /admin-page-frame__header/)
assert.match(sidebar, /景区数字人管理后台/)
assert.match(sidebar, /admin-sider__status/)

for (const key of requiredMenuKeys) {
  assert.match(meta, new RegExp(`['\"]?${key}['\"]?\\s*:`), `missing page metadata for ${key}`)
}

assert.match(theme, /--cockpit-bg:\s*#071522/i)
assert.match(theme, /--cockpit-panel:\s*#0b2030/i)
assert.match(theme, /--cockpit-cyan:\s*#19c4d2/i)
assert.match(theme, /\.admin-sider\s*\{[^}]*208px/is)
assert.match(theme, /\.admin-topbar\s*\{[^}]*height:\s*56px/is)
assert.match(theme, /@media\s*\(max-width:\s*1024px\)/)
assert.match(theme, /@media\s*\(max-width:\s*768px\)/)
assert.match(theme, /\.admin-content\s*\{[^}]*overflow:\s*auto/is)
assert.match(layout, /<QaRecordsPage\s*\/\>/)
assert.match(qaPage, /listQaSessions/)
assert.match(qaPage, /getQaSessionMessages/)
assert.match(qaPage, /<Drawer/)
assert.match(qaPage, /qa-records-page/)
assert.match(qaApi, /\/api\/admin\/guide\/sessions/)

console.log('admin cockpit design contract verified')
