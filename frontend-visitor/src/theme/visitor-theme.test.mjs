import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import {
  VISITOR_THEME_STORAGE_KEY,
  isVisitorThemeMode,
  resolveVisitorTheme,
} from './visitorTheme.ts'

const provider = readFileSync(new URL('./VisitorThemeProvider.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
const readSource = (path) => {
  const url = new URL(path, import.meta.url)
  return existsSync(url) ? readFileSync(url, 'utf8') : ''
}

const tokens = readSource('../styles/tokens.css')
const indexCss = readSource('../index.css')
const appCss = readSource('../App.css')
const main = readSource('../main.tsx')
const visitorThemePages = readSource('../styles/visitor-theme-pages.css')

const requiredTokens = [
  '--visitor-bg',
  '--visitor-bg-elevated',
  '--visitor-surface',
  '--visitor-surface-strong',
  '--visitor-surface-muted',
  '--visitor-border',
  '--visitor-border-strong',
  '--visitor-text',
  '--visitor-text-secondary',
  '--visitor-text-muted',
  '--visitor-accent',
  '--visitor-accent-strong',
  '--visitor-accent-soft',
  '--visitor-focus',
  '--visitor-danger',
  '--visitor-shadow',
  '--visitor-overlay',
]

const authenticatedPageStyles = [
  ['HomePage.css', '.home-page'],
  ['DigitalHumanPage.css', '.module-screen'],
  ['LiveBroadcastPage.css', '.live-broadcast-page'],
  ['MapPage.css', '.page-shell--map'],
  ['FeedbackPage.css', '.feedback-page'],
  ['HistoryPage.css', '.history-page'],
  ['ProfilePage.css', '.profile-page'],
  ['TravelTipsPage.css', '.travel-tips-page'],
  ['SpotRecommendPage.css', '.spot-page'],
  ['RouteRecommendListPage.css', '.route-list-page'],
]

test('visitor auto theme uses the agreed day window', () => {
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 6, 59)), 'dark')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 7, 0)), 'light')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 18, 59)), 'light')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 19, 0)), 'dark')
})

test('visitor theme is isolated from the admin theme', () => {
  assert.equal(VISITOR_THEME_STORAGE_KEY, 'digital-human.visitor-theme-mode')
  assert.equal(isVisitorThemeMode('auto'), true)
  assert.equal(isVisitorThemeMode('light'), true)
  assert.equal(isVisitorThemeMode('dark'), true)
  assert.equal(isVisitorThemeMode('sepia'), false)
  assert.doesNotMatch(provider, /admin-theme|adminTheme/)
  assert.match(provider, /dataset\.visitorTheme = effectiveTheme/)
  assert.match(provider, /dataset\.visitorThemeMode = mode/)
  assert.match(app, /<VisitorThemeProvider>[\s\S]*<VisitorTopNav[\s\S]*<Outlet \/>/)
})

test('visitor semantic tokens define complete dark and light themes', () => {
  const darkBlock = tokens.match(/:root,\s*html\[data-visitor-theme=['"]dark['"]\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const lightBlock = tokens.match(/html\[data-visitor-theme=['"]light['"]\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''

  for (const token of requiredTokens) {
    assert.match(darkBlock, new RegExp(`${token}\\s*:`), `${token} must have a dark default`)
    assert.match(lightBlock, new RegExp(`${token}\\s*:`), `${token} must have a light override`)
  }
})

test('shared authenticated styles consume visitor semantic tokens', () => {
  assert.match(main, /styles\/visitor-theme-pages\.css/, 'page-level theme corrections must be loaded')
  assert.match(indexCss, /var\(--visitor-(?:bg|text)/, 'global styles must consume visitor background or text tokens')
  assert.match(appCss, /var\(--visitor-surface/, 'shared cards must consume visitor surface tokens')
  assert.match(appCss, /var\(--visitor-overlay/, 'mobile navigation must consume the visitor overlay token')
  assert.match(indexCss, /:focus-visible[\s\S]*var\(--visitor-focus\)/, 'global focus must use the visitor focus token')
  assert.match(indexCss, /prefers-reduced-motion:\s*reduce/, 'global styles must respect reduced motion')
})

test('every authenticated page is covered by semantic visitor styles', () => {
  for (const [stylesheet, pageRoot] of authenticatedPageStyles) {
    const pageCss = readSource(`../pages/${stylesheet}`)
    const consumesToken = /var\(--visitor-/.test(pageCss)
    const hasScopedCorrection = visitorThemePages.includes(pageRoot)
    assert.ok(consumesToken || hasScopedCorrection, `${stylesheet} must consume visitor tokens or have a scoped page correction`)
  }
})
