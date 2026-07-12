import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(sourceRoot, path), 'utf8')

const tokens = read('styles/tokens.css')
const app = read('App.tsx')
const main = read('main.tsx')
const topNavCss = read('components/VisitorTopNav.css')
const bottomNav = read('components/MobileBottomNav.tsx')
const indexCss = read('index.css')
const digitalHumanCss = read('pages/DigitalHumanPage.css')
const mapPage = read('pages/MapPage.tsx')
const mapCss = read('pages/MapPage.css')
const routeCss = read('pages/RouteRecommendPage.css')
const loginCss = read('pages/LoginPage.css')
const profileCss = read('pages/ProfilePage.css')

assert.match(tokens, /--touch-target:\s*44px/, 'touch targets must be at least 44px')
assert.match(tokens, /--safe-bottom:\s*env\(safe-area-inset-bottom/, 'safe-area bottom inset is required')
assert.match(tokens, /--mobile-nav-height:/, 'mobile navigation height token is required')
assert.match(main, /styles\/tokens\.css/, 'global tokens must be loaded by the app entry')
assert.match(app, /<MobileBottomNav\s*\/>/, 'authenticated routes must render the mobile bottom navigation JSX')
assert.match(bottomNav, /首页[\s\S]*AI 导览[\s\S]*路线[\s\S]*地图[\s\S]*我的/, 'bottom navigation exposes five core entries')
for (const path of ['/home', '/modules/digital-human', '/routes', '/map', '/profile']) {
  assert.match(bottomNav, new RegExp(`to:\\s*['"]${path}['"]`), `bottom navigation must link to ${path}`)
}
assert.match(topNavCss, /@media\s*\([^)]*max-width:\s*768px[^)]*\)[\s\S]*\.visitor-topbar__nav[\s\S]*display:\s*none/, 'desktop navigation is hidden at the mobile breakpoint')
assert.match(indexCss, /padding-bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*var\(--safe-bottom\)\)/, 'routed pages reserve bottom navigation and safe-area space')

const digitalMobileStart = digitalHumanCss.lastIndexOf('@media (max-width: 768px)')
const digitalBeforeMobile = digitalHumanCss.slice(0, digitalMobileStart)
for (const selector of ['.live2d-page {', '.live2d-canvas {', '.digital-human-chat {']) {
  assert.ok(digitalBeforeMobile.includes(selector), `digital-human mobile overrides must follow base selector ${selector}`)
}
const digitalMobile = digitalHumanCss.slice(digitalMobileStart)
assert.match(digitalMobile, /\.live2d-page\s*\{[^}]*overflow-y:\s*auto/s, 'digital-human page scrolls vertically on mobile')
assert.match(digitalMobile, /\.live2d-canvas\s*\{[^}]*position:\s*relative/s, 'digital-human canvas participates in the mobile stack')
assert.match(digitalMobile, /\.digital-human-chat\s*\{[^}]*position:\s*relative[^}]*inset:\s*auto[^}]*width:\s*auto/s, 'digital-human chat participates in the mobile stack')

assert.match(mapPage, /map-page--spot-selected/, 'map exposes selected-spot state to responsive CSS')
assert.doesNotMatch(mapPage, /<aside className="map-side"[^>]*aria-hidden/, 'visible desktop map sidebar must remain exposed to assistive technology')
assert.match(mapCss, /\.map-page--spot-selected\s+\.map-side\s*\{[^}]*display:\s*none/s, 'selected spot card hides the mobile map side card')
assert.match(routeCss, /@media\s*\(max-width:\s*768px\)[\s\S]*\.route-planner\s*\{[^}]*flex-direction:\s*column/s, 'route planner stacks vertically')
assert.match(loginCss, /@media\s*\(max-width:\s*768px\)[\s\S]*\.auth-stage,[\s\S]*\.auth-form\s*\{[^}]*grid-template-columns:\s*1fr/s, 'login form is single-column')
assert.match(profileCss, /@media\s*\(max-width:\s*768px\)[\s\S]*\.profile-grid,[\s\S]*\.profile-stats\s*\{[^}]*grid-template-columns:\s*1fr/s, 'profile form content is single-column')

const routedPageStyles = [
  'DigitalHumanPage.css',
  'FeedbackPage.css',
  'HistoryPage.css',
  'HomePage.css',
  'LoginPage.css',
  'MapPage.css',
  'ProfilePage.css',
  'RouteRecommendListPage.css',
  'RouteRecommendPage.css',
  'SpotRecommendPage.css',
  'TravelTipsPage.css',
]

for (const stylesheet of routedPageStyles) {
  assert.match(
    read(`pages/${stylesheet}`),
    /@media\s*\([^)]*max-width:\s*768px/,
    `${stylesheet} must define routed-page mobile behavior`,
  )
}

console.log(`responsive contract passed for ${routedPageStyles.length} routed page styles`)
