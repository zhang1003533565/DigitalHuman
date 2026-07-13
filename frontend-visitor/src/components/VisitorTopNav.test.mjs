import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const componentUrl = new URL('./VisitorTopNav.tsx', import.meta.url)
const cssUrl = new URL('./VisitorTopNav.css', import.meta.url)
const appUrl = new URL('../App.tsx', import.meta.url)
const appCssUrl = new URL('../App.css', import.meta.url)
const source = readFileSync(fileURLToPath(componentUrl), 'utf8')
const css = readFileSync(fileURLToPath(cssUrl), 'utf8')
const appSource = readFileSync(fileURLToPath(appUrl), 'utf8')
const appCss = readFileSync(fileURLToPath(appCssUrl), 'utf8')

const routedPages = [
  '../pages/HomePage.tsx',
  '../pages/DigitalHumanPage.tsx',
  '../pages/RouteRecommendPage.tsx',
  '../pages/MapPage.tsx',
  '../pages/TravelTipsPage.tsx',
  '../pages/FeedbackPage.tsx',
  '../pages/HistoryPage.tsx',
  '../pages/ProfilePage.tsx',
  '../pages/SpotRecommendPage.tsx',
  '../pages/RouteRecommendListPage.tsx',
  '../pages/LiveBroadcastPage.tsx',
]

const expectedItems = [
  ['/home', '首页'],
  ['/modules/digital-human', 'AI 导览'],
  ['/routes', '路线推荐'],
  ['/map', '景点地图'],
  ['/tips', '游览贴士'],
  ['/feedback', '反馈记录'],
  ['/history', '会话历史'],
]

const navItemsBlock = source.match(/const VISITOR_NAV_ITEMS = \[(.*?)\n\]/s)?.[1]
assert.ok(navItemsBlock, 'VISITOR_NAV_ITEMS must be a source-level fixed array')
const actualItems = [...navItemsBlock.matchAll(/\{ to: (?:'([^']+)'|DIGITAL_HUMAN_ROUTE), label: '([^']+)'(?:, activeFor: \[[^\]]+\])? \}/g)].map(
  ([, literalPath, label]) => [literalPath || '/modules/digital-human', label],
)
assert.deepEqual(actualItems, expectedItems)

assert.match(source, /export function VisitorTopNav/)
assert.match(source, /type VisitorTopNavProps = \{ onLogout: \(\) => void \}/)
assert.match(source, /灵山智游/)
assert.match(source, /getStoredUser\(\)/)
assert.match(source, /<NavLink/)
assert.match(source, /useLocation/)
assert.match(source, /activeFor:\s*\['\/routes', '\/route-recommend'\]/)
assert.match(source, /activeFor:\s*\['\/map', '\/spot-recommend'\]/)
assert.match(source, /item\.activeFor\.includes\(location\.pathname\)/)

assert.doesNotMatch(source, /variant|items\?|title\?/)
assert.match(source, /onClick=\{toggleDropdown\}/)
assert.doesNotMatch(source, /onFocus=\{handleAvatarFocus\}/)
assert.doesNotMatch(source, /function handleAvatarFocus/)
assert.match(source, /event\.key === 'Escape'/)
assert.match(source, /avatarRef\.current\?\.focus\(\)/)
assert.doesNotMatch(source, /aria-haspopup/)
assert.match(source, /aria-expanded=\{dropdownOpen\}/)
assert.match(source, /aria-controls=\{dropdownOpen \? USER_MENU_ID : undefined\}/)
assert.match(source, /const shouldFocusActionRef = useRef\(false\)/)
assert.match(source, /const profileActionRef = useRef<HTMLButtonElement>\(null\)/)
assert.match(source, /shouldFocusActionRef\.current = true[\s\S]*openDropdown\(\)/)
assert.match(source, /requestAnimationFrame\(\(\) => profileActionRef\.current\?\.focus\(\)\)/)
assert.match(source, /ref=\{profileActionRef\}/)
assert.match(source, /id=\{USER_MENU_ID\}/)
assert.match(source, /role="group"/)
assert.match(source, /aria-label="用户操作"/)
assert.doesNotMatch(source, /role="menu(?:item)?"/)
assert.match(source, /window\.addEventListener\('resize', handleResize\)/)
assert.match(source, /window\.removeEventListener\('resize', handleResize\)/)
assert.match(css, /min-height:\s*64px/)
assert.match(css, /"Songti SC"/)
assert.match(css, /background:\s*#e2ad4b/)
assert.match(css, /line-height:\s*1\.1/)
assert.match(css, /text-shadow:\s*none/)
assert.match(css, /box-shadow:[^;]*inset/s)
assert.match(css, /animation:\s*visitorUserMenuIn/)
assert.match(css, /\.visitor-user-menu__avatar--lg\s*\{[^}]*border-color:/s)
assert.match(css, /\.visitor-user-menu__item\s*\{[^}]*transition:/s)
assert.match(
  appCss,
  /\.authenticated-app\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*overflow:\s*hidden;/s,
  'authenticated shell must stack the shared navigation and routed content',
)
assert.match(
  appCss,
  /\.authenticated-app__content\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s,
  'routed content must consume only the height below the shared navigation',
)
assert.doesNotMatch(css, /\.page-shell:not\(\.home-page\) > \.visitor-topbar/, 'navigation must not depend on page padding compensation')
assert.doesNotMatch(css, /\.module-screen > \.visitor-topbar/, 'navigation must not be positioned by routed page roots')
assert.match(css, /@media \(max-width: 768px\)/)
assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1100px\)/)
assert.match(css, /\.visitor-topbar__nav\s*\{[^}]*overflow-x:\s*auto;[^}]*white-space:\s*nowrap;/s)
assert.match(css, /\.visitor-user-menu\s*\{[^}]*position:\s*relative;/s)
assert.doesNotMatch(css, /\.visitor-user-menu\s*\{[^}]*position:\s*absolute;/s)
assert.doesNotMatch(css, /--home/)

assert.equal((appSource.match(/<VisitorTopNav onLogout=\{onLogout\} \/>/g) ?? []).length, 1)
assert.match(
  appSource,
  /<VisitorTopNav onLogout=\{onLogout\} \/>[\s\S]*authenticated-app__content[\s\S]*<Outlet \/>/,
)

for (const relativePath of routedPages) {
  const pageUrl = new URL(relativePath, import.meta.url)
  const page = readFileSync(fileURLToPath(pageUrl), 'utf8')
  assert.doesNotMatch(page, /VisitorTopNav/, `${relativePath} must rely on the authenticated shell`)
  const removedPageConfiguration = new RegExp(
    [['App', 'TopNav'].join(''), ['HOME', 'NAV', 'ITEMS'].join('_'), ['variant', '="home"'].join('')].join('|'),
  )
  assert.doesNotMatch(page, removedPageConfiguration, relativePath)
}

console.log('VisitorTopNav contract passed')
