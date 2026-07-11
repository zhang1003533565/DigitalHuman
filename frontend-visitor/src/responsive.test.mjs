import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(sourceRoot, path), 'utf8')

const tokens = read('styles/tokens.css')
const app = read('App.tsx')
const main = read('main.tsx')
const topNavCss = read('components/AppTopNav.css')
const bottomNav = read('components/MobileBottomNav.tsx')
const indexCss = read('index.css')

assert.match(tokens, /--touch-target:\s*44px/, 'touch targets must be at least 44px')
assert.match(tokens, /--safe-bottom:\s*env\(safe-area-inset-bottom/, 'safe-area bottom inset is required')
assert.match(tokens, /--mobile-nav-height:/, 'mobile navigation height token is required')
assert.match(main, /styles\/tokens\.css/, 'global tokens must be loaded by the app entry')
assert.match(app, /MobileBottomNav/, 'authenticated routes must render the mobile bottom navigation')
assert.match(bottomNav, /首页[\s\S]*AI 导览[\s\S]*路线[\s\S]*地图[\s\S]*我的/, 'bottom navigation exposes five core entries')
assert.match(topNavCss, /@media\s*\([^)]*max-width:\s*768px[^)]*\)[\s\S]*\.app-topbar__nav[\s\S]*display:\s*none/, 'desktop navigation is hidden at the mobile breakpoint')
assert.match(indexCss, /padding-bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*var\(--safe-bottom\)\)/, 'routed pages reserve bottom navigation and safe-area space')

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
