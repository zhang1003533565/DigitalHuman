import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const componentUrl = new URL('./VisitorTopNav.tsx', import.meta.url)
const themeSwitchUrl = new URL('./VisitorThemeSwitch.tsx', import.meta.url)
const cssUrl = new URL('./VisitorTopNav.css', import.meta.url)
const appUrl = new URL('../App.tsx', import.meta.url)
const appCssUrl = new URL('../App.css', import.meta.url)
const homeCssUrl = new URL('../pages/HomePage.css', import.meta.url)
const source = readFileSync(fileURLToPath(componentUrl), 'utf8')
const themeSwitch = readFileSync(fileURLToPath(themeSwitchUrl), 'utf8')
const css = readFileSync(fileURLToPath(cssUrl), 'utf8')
const appSource = readFileSync(fileURLToPath(appUrl), 'utf8')
const appCss = readFileSync(fileURLToPath(appCssUrl), 'utf8')
const homeCss = readFileSync(fileURLToPath(homeCssUrl), 'utf8')

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
  ['/live', '数字人直播'],
  ['/map', '景点地图'],
]

const expectedUserItems = [
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

const userItemsBlock = source.match(/const USER_NAV_ITEMS = \[(.*?)\n\]/s)?.[1]
assert.ok(userItemsBlock, 'USER_NAV_ITEMS must be a source-level fixed array')
const actualUserItems = [...userItemsBlock.matchAll(/\{ to: '([^']+)', label: '([^']+)'/g)].map(
  ([, path, label]) => [path, label],
)
assert.deepEqual(actualUserItems, expectedUserItems)
assert.match(source, /USER_NAV_ITEMS\.map/)
assert.match(source, /setDropdownOpen\(false\)[\s\S]*navigate\(item\.to\)/)
assert.match(source, /aria-current=\{item\.to === location\.pathname \? 'page' : undefined\}/)
assert.match(source, /visitor-user-menu__item--active/)
assert.match(
  css,
  /\.visitor-user-menu__dropdown\s*\{[^}]*max-height:\s*calc\(100dvh - var\(--visitor-user-menu-top\) - 12px\);/s,
)
assert.match(css, /\.visitor-user-menu__dropdown\s*\{[^}]*overflow-y:\s*auto;/s)
assert.match(css, /\.visitor-user-menu__dropdown\s*\{[^}]*overscroll-behavior:\s*contain;/s)
assert.match(source, /const availableBelow = window\.innerHeight - preferredTop - VIEWPORT_INSET/)
assert.match(source, /const VIEWPORT_INSET = 12/)
assert.match(source, /const MIN_MENU_VIEWPORT_HEIGHT = 88/)
assert.match(source, /const preferredTop = rect\.bottom \+ 10/)
assert.match(
  source,
  /const menuTop =\s*availableBelow >= MIN_MENU_VIEWPORT_HEIGHT \? preferredTop : VIEWPORT_INSET/,
)
assert.match(source, /'--visitor-user-menu-top': `\$\{menuTop\}px`/)
assert.equal((userItemsBlock.match(/aria-hidden="true"/g) ?? []).length, expectedUserItems.length)

const profileIndex = source.indexOf('个人资料')
const userNavigationIndex = source.indexOf('USER_NAV_ITEMS.map')
const userNavigationDividerIndex = source.indexOf('<div className="visitor-user-menu__divider" />', userNavigationIndex)
const logoutIndex = source.indexOf('退出登录')
assert.ok(
  profileIndex < userNavigationIndex &&
    userNavigationIndex < userNavigationDividerIndex &&
    userNavigationDividerIndex < logoutIndex,
)

assert.match(source, /export function VisitorTopNav/)
assert.match(source, /type VisitorTopNavProps = \{ onLogout: \(\) => void \}/)
assert.match(source, /灵山智游/)
assert.match(source, /getStoredUser\(\)/)
assert.match(source, /<NavLink/)
assert.match(source, /useLocation/)
assert.match(source, /activeFor:\s*\['\/routes', '\/route-recommend'\]/)
assert.match(source, /activeFor:\s*\['\/map', '\/spot-recommend'\]/)
assert.match(source, /item\.activeFor\.includes\(location\.pathname\)/)

assert.match(source, /<VisitorThemeSwitch placement="header" \/>/)
assert.match(source, /<VisitorThemeSwitch placement="menu" \/>/)
assert.match(themeSwitch, /aria-label="主题模式"/)
assert.match(themeSwitch, /自动/)
assert.match(themeSwitch, /日间/)
assert.match(themeSwitch, /夜间/)
assert.match(themeSwitch, /aria-pressed=\{mode === option\.value\}/)
assert.match(css, /\.visitor-theme-switch--header/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*visitor-theme-switch--header[\s\S]*display:\s*none/)

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
assert.match(css, /\.visitor-topbar\s*\{[^}]*display:\s*flex;/s)
assert.match(css, /\.visitor-topbar\s*\{[^}]*min-height:\s*64px;/s)
assert.match(css, /\.visitor-topbar\s*\{[^}]*background:\s*var\(--visitor-nav-surface\);/s)
assert.match(css, /"Songti SC"/)
assert.match(css, /background:\s*#e2ad4b/)
assert.match(css, /line-height:\s*1\.1/)
assert.match(css, /text-shadow:\s*none/)
assert.match(css, /box-shadow:[^;]*inset/s)
assert.match(css, /animation:\s*visitorUserMenuIn/)
assert.match(css, /\.visitor-user-menu__avatar--lg\s*\{[^}]*border-color:/s)
assert.match(css, /\.visitor-user-menu__item\s*\{[^}]*transition:/s)
assert.match(css, /\.visitor-user-menu__item\s*\{[^}]*min-height:\s*44px;/s)
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
assert.doesNotMatch(homeCss, /\.visitor-topbar/, 'routed page styles must not control the global navigation')
assert.match(css, /@media \(max-width: 768px\)/)
assert.match(css, /@media \(min-width: 769px\) and \(max-width: 1100px\)/)
assert.match(css, /\.visitor-topbar__nav\s*\{[^}]*overflow-x:\s*auto;[^}]*white-space:\s*nowrap;/s)
assert.match(css, /\.visitor-topbar__nav\s*\{[^}]*overflow-y:\s*hidden;/s)
assert.match(css, /\.visitor-topbar__nav\s*\{[^}]*scrollbar-width:\s*none;/s)
assert.match(css, /\.visitor-topbar__nav::-webkit-scrollbar\s*\{[^}]*display:\s*none;/s)
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
