import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import {
  VISITOR_THEME_STORAGE_KEY,
  isVisitorThemeMode,
  resolveVisitorTheme,
} from './visitorTheme.ts'
import { createVisitorMapThemeController, getVisitorMapStyle } from './visitorMapTheme.ts'

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

const expectedTokenValues = {
  dark: {
    '--visitor-bg': '#07111f',
    '--visitor-bg-elevated': '#0b1728',
    '--visitor-surface': '#101d30',
    '--visitor-surface-strong': '#16263b',
    '--visitor-surface-muted': 'rgba(255, 255, 255, 0.055)',
    '--visitor-border': 'rgba(146, 190, 224, 0.18)',
    '--visitor-border-strong': 'rgba(126, 207, 232, 0.42)',
    '--visitor-text': '#f5f8fb',
    '--visitor-text-secondary': '#c1cfda',
    '--visitor-text-muted': '#8296a8',
    '--visitor-accent': '#27b8c7',
    '--visitor-accent-strong': '#0f8fa1',
    '--visitor-accent-soft': 'rgba(39, 184, 199, 0.15)',
    '--visitor-focus': '#78dce8',
    '--visitor-danger': '#ff8175',
    '--visitor-shadow': '0 18px 48px rgba(0, 0, 0, 0.28)',
    '--visitor-overlay': 'rgba(4, 13, 24, 0.92)',
  },
  light: {
    '--visitor-bg': '#f3f5f4',
    '--visitor-bg-elevated': '#eef2f1',
    '--visitor-surface': '#ffffff',
    '--visitor-surface-strong': '#f8faf9',
    '--visitor-surface-muted': '#edf4f3',
    '--visitor-border': '#d9e2e1',
    '--visitor-border-strong': '#9cc9ca',
    '--visitor-text': '#16313a',
    '--visitor-text-secondary': '#526a72',
    '--visitor-text-muted': '#7a8d92',
    '--visitor-accent': '#087f8c',
    '--visitor-accent-strong': '#066674',
    '--visitor-accent-soft': '#e2f2f1',
    '--visitor-focus': '#0b7180',
    '--visitor-danger': '#bc3f36',
    '--visitor-shadow': '0 14px 36px rgba(48, 75, 78, 0.11)',
    '--visitor-overlay': 'rgba(255, 255, 255, 0.94)',
  },
}

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

const readDeclarations = (body) => new Map(
  [...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)\s*;/g)]
    .map((match) => [match[1], match[2].trim()]),
)

const ruleBodies = (css, selector) => {
  const bodies = []
  for (const match of css.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1].split(',').map((value) => value.trim())
    if (selectors.includes(selector)) bodies.push(match[2])
  }
  return bodies
}

const assertRuleUses = (css, stylesheet, selector, expectedDeclarations) => {
  const bodies = ruleBodies(css, selector)
  assert.notEqual(bodies.length, 0, `${stylesheet} must define ${selector}`)
  for (const [property, token] of Object.entries(expectedDeclarations)) {
    assert.ok(
      bodies.some((body) => {
        const declarations = readDeclarations(body)
        const actualValue = declarations.get(property)
          ?? (property === 'border-color' ? declarations.get('border') : undefined)
          ?? (property === 'border' ? declarations.get('border-color') : undefined)
        return actualValue?.includes(`var(${token})`)
      }),
      `${stylesheet} ${selector} ${property} must use ${token}`,
    )
  }
}

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

test('visitor map theme maps effective theme to the agreed AMap styles', () => {
  assert.equal(getVisitorMapStyle('dark'), 'amap://styles/darkblue')
  assert.equal(getVisitorMapStyle('light'), 'amap://styles/normal')
})

test('visitor map theme controller uses the latest theme when deferred map creation resolves', async () => {
  let resolveAMap
  const styleErrors = []
  const controller = createVisitorMapThemeController('light', (error) => styleErrors.push(error))
  const state = {
    overlays: ['existing-overlay'],
    selectedFacility: { id: 'facility-1' },
  }
  const createdMaps = []
  const loadAMap = new Promise((resolve) => {
    resolveAMap = resolve
  })

  const creation = loadAMap.then((AMap) => controller.ensureMap((mapStyle) => {
    const map = new AMap.Map('map-container', { mapStyle, zoom: 15 })
    createdMaps.push(map)
    return map
  }))

  controller.setTheme('dark')
  resolveAMap({
    Map: class FakeMap {
      constructor(container, options) {
        this.container = container
        this.options = { ...options }
        this.setMapStyleCalls = []
        this.destroyCalls = 0
      }

      setMapStyle(style) {
        this.setMapStyleCalls.push(style)
        this.options.mapStyle = style
      }

      destroy() {
        this.destroyCalls += 1
      }
    },
  })

  const map = await creation
  assert.equal(createdMaps.length, 1)
  assert.equal(map.options.mapStyle, 'amap://styles/darkblue')
  assert.deepEqual(map.setMapStyleCalls, ['amap://styles/darkblue'])
  assert.equal(map.destroyCalls, 0)
  assert.deepEqual(state, {
    overlays: ['existing-overlay'],
    selectedFacility: { id: 'facility-1' },
  })

  controller.setTheme('light')
  controller.syncMapStyle()

  assert.equal(controller.ensureMap(() => {
    throw new Error('theme sync must not recreate the map instance')
  }), map)
  assert.equal(createdMaps.length, 1)
  assert.equal(map.destroyCalls, 0)
  assert.deepEqual(map.setMapStyleCalls, ['amap://styles/darkblue', 'amap://styles/normal'])
  assert.deepEqual(state, {
    overlays: ['existing-overlay'],
    selectedFacility: { id: 'facility-1' },
  })
  assert.deepEqual(styleErrors, [])
})

test('visitor semantic tokens define complete dark and light themes', () => {
  const darkBlock = tokens.match(/:root,\s*html\[data-visitor-theme=['"]dark['"]\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const lightBlock = tokens.match(/html\[data-visitor-theme=['"]light['"]\]\s*\{([\s\S]*?)\}/)?.[1] ?? ''
  const themeBlocks = {
    dark: readDeclarations(darkBlock),
    light: readDeclarations(lightBlock),
  }

  for (const [theme, expectedValues] of Object.entries(expectedTokenValues)) {
    for (const [token, expectedValue] of Object.entries(expectedValues)) {
      assert.equal(themeBlocks[theme].get(token), expectedValue, `${token} must use the exact ${theme} value`)
    }
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

test('every authenticated stylesheet exists and is non-empty', () => {
  for (const [stylesheet] of authenticatedPageStyles) {
    const url = new URL(`../pages/${stylesheet}`, import.meta.url)
    assert.equal(existsSync(url), true, `${stylesheet} must exist`)
    assert.notEqual(readFileSync(url, 'utf8').trim(), '', `${stylesheet} must not be empty`)
  }
  assert.notEqual(visitorThemePages.trim(), '', 'visitor-theme-pages.css must exist and be non-empty')
})

test('authenticated pages map representative surfaces to semantic visitor tokens', () => {
  const contracts = [
    ['HomePage.css', '.page-shell.home-page', { background: '--visitor-bg' }],
    ['HomePage.css', '.hp-route-card', { border: '--visitor-border', background: '--visitor-surface' }],
    ['HomePage.css', '.hp-section__title h2', { color: '--visitor-text' }],
    ['HomePage.css', '.hp-route-card__description', { color: '--visitor-text-secondary' }],
    ['DigitalHumanPage.css', '.module-screen', { background: '--visitor-bg', color: '--visitor-text' }],
    ['DigitalHumanPage.css', '.digital-human-chat', { 'border-color': '--visitor-border-strong', background: '--visitor-surface' }],
    ['DigitalHumanPage.css', '.digital-chat-message__bubble', { border: '--visitor-border', background: '--visitor-surface-strong' }],
    ['DigitalHumanPage.css', '.guide-result-card', { border: '--visitor-border', background: '--visitor-surface' }],
    ['DigitalHumanPage.css', '.guide-result-card strong', { color: '--visitor-text' }],
    ['DigitalHumanPage.css', '.guide-result-card__actions button', { border: '--visitor-border-strong', color: '--visitor-accent', background: '--visitor-accent-soft' }],
    ['DigitalHumanPage.css', '.digital-human-answer__sources span', { color: '--visitor-text-secondary', background: '--visitor-surface-muted' }],
    ['DigitalHumanPage.css', '.digital-mobile-settings-trigger', { color: '--visitor-text', border: '--visitor-border-strong', background: '--visitor-overlay' }],
    ['LiveBroadcastPage.css', '.live-broadcast-page', { color: '--visitor-text', background: '--visitor-bg' }],
    ['LiveBroadcastPage.css', '.live-interaction', { border: '--visitor-border', background: '--visitor-surface' }],
    ['LiveBroadcastPage.css', '.live-chat__input', { border: '--visitor-border', color: '--visitor-text', background: '--visitor-surface-strong' }],
    ['MapPage.css', '.page-shell--map', { color: '--visitor-text', background: '--visitor-bg' }],
    ['MapPage.css', '.map-spot-card', { border: '--visitor-border-strong', background: '--visitor-surface' }],
    ['MapPage.css', '.map-spot-card__meta', { color: '--visitor-text-secondary' }],
    ['MapPage.css', '.map-sidebar', { background: '--visitor-surface' }],
    ['FeedbackPage.css', '.feedback-composer', { border: '--visitor-border', background: '--visitor-surface' }],
    ['FeedbackPage.css', '.feedback-composer__body label', { color: '--visitor-text-secondary' }],
    ['HistoryPage.css', '.history-page .history-message', { border: '--visitor-border', background: '--visitor-surface' }],
    ['HistoryPage.css', '.history-page .history-message__body', { color: '--visitor-text' }],
    ['ProfilePage.css', '.profile-page .profile-identity', { border: '--visitor-border', background: '--visitor-surface' }],
    ['ProfilePage.css', '.profile-page .profile-identity__meta h1', { color: '--visitor-text' }],
    ['TravelTipsPage.css', '.travel-tips-page', { color: '--visitor-text', background: '--visitor-bg' }],
    ['TravelTipsPage.css', '.tips-card', { border: '--visitor-border', background: '--visitor-surface' }],
    ['SpotRecommendPage.css', '.spot-page', { color: '--visitor-text', background: '--visitor-bg' }],
    ['SpotRecommendPage.css', '.spot-page__card', { border: '--visitor-border', background: '--visitor-surface' }],
    ['RouteRecommendListPage.css', '.route-list-page', { color: '--visitor-text', background: '--visitor-bg' }],
    ['RouteRecommendListPage.css', '.route-list-page__card', { border: '--visitor-border', background: '--visitor-surface' }],
  ]

  for (const [stylesheet, selector, declarations] of contracts) {
    assertRuleUses(readSource(`../pages/${stylesheet}`), stylesheet, selector, declarations)
  }
})

test('fixed dark and status live surfaces keep explicit light foregrounds', () => {
  const liveCss = readSource('../pages/LiveBroadcastPage.css')
  for (const selector of [
    '.live-stage__badge',
    '.live-stage__subtitle',
    '.live-chat__header span',
    '.live-chat__message--viewer',
    '.live-chat__message',
  ]) {
    assert.match(ruleBodies(liveCss, selector).join('\n'), /color:\s*(?:#fff(?:fff)?|white)\s*;/i, `${selector} must keep an explicit light foreground`)
  }
})
