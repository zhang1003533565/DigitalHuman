import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const read = (path) => readFileSync(join(sourceRoot, path), 'utf8')

const findClosingBrace = (css, openingBrace) => {
  let depth = 1
  for (let index = openingBrace + 1; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1
    if (css[index] === '}') depth -= 1
    if (depth === 0) return index
  }
  throw new Error(`unclosed CSS block at offset ${openingBrace}`)
}

const readDeclarations = (body) => {
  const declarations = new Map()
  for (const match of body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)\s*;/g)) {
    declarations.set(match[1], match[2].trim())
  }
  return declarations
}

const readRules = (css) => {
  const rules = []
  for (const match of css.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = readDeclarations(match[2])
    for (const selector of match[1].split(',').map((value) => value.trim())) {
      if (selector && !selector.startsWith('@')) rules.push({ selector, declarations })
    }
  }
  return rules
}

const readMobileMediaCss = (css) => {
  const blocks = []
  const mediaPattern = /@media\s*([^{}]+)\{/g
  for (const match of css.matchAll(mediaPattern)) {
    const widths = [...match[1].matchAll(/max-width\s*:\s*(\d+)px/g)].map((width) => Number(width[1]))
    if (!widths.some((width) => width <= 768)) continue
    const openingBrace = match.index + match[0].length - 1
    blocks.push(css.slice(openingBrace + 1, findClosingBrace(css, openingBrace)))
  }
  return blocks.join('\n')
}

const isVerticalScroller = (declarations) => {
  const overflowY = declarations.get('overflow-y')?.replace(/\s*!important\s*$/, '')
  if (overflowY === 'auto' || overflowY === 'scroll') return true
  const overflow = declarations.get('overflow')?.replace(/\s*!important\s*$/, '').split(/\s+/)
  const shorthandY = overflow?.[1] ?? overflow?.[0]
  return shorthandY === 'auto' || shorthandY === 'scroll'
}

const hasBoundedLocalScroll = (css, selector) => readRules(css).some((rule) => {
  if (rule.selector !== selector || rule.declarations.get('overflow-y') !== 'auto') return false
  const maxHeight = rule.declarations.get('max-height')
  return Boolean(maxHeight && !/^(?:auto|none|initial|inherit|unset|revert)(?:\s*!important)?$/.test(maxHeight))
})

const tokens = read('styles/tokens.css')
const app = read('App.tsx')
const main = read('main.tsx')
const topNavCss = read('components/VisitorTopNav.css')
const bottomNav = read('components/MobileBottomNav.tsx')
const appCss = read('App.css')
const digitalHumanCss = read('pages/DigitalHumanPage.css')
const mapPage = read('pages/MapPage.tsx')
const mapCss = read('pages/MapPage.css')
const routeCss = read('pages/RouteRecommendPage.css')
const loginCss = read('pages/LoginPage.css')
const homeCss = read('pages/HomePage.css')
const travelTipsCss = read('pages/TravelTipsPage.css')
const profileCss = read('pages/ProfilePage.css')
const liveBroadcastCss = read('pages/LiveBroadcastPage.css')

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
const appMobile = appCss.slice(appCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(appCss, /\.authenticated-app\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column[^}]*overflow:\s*hidden/s, 'authenticated shell stacks navigation and content without viewport overflow')
assert.match(appCss, /\.authenticated-app__content\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s, 'authenticated content consumes the remaining viewport height')
assert.match(appCss, /\.authenticated-app__content\s*>\s*\*\s*\{[^}]*height:\s*100%/s, 'desktop routed roots fill the authenticated content area')
assert.match(appMobile, /\.authenticated-app__content\s*\{[^}]*overflow-x:\s*hidden[^}]*overflow-y:\s*auto/s, 'mobile authenticated content owns vertical scrolling')
assert.match(appMobile, /\.authenticated-app__content\s*>\s*\*\s*\{[^}]*height:\s*auto[^}]*min-height:\s*100%/s, 'mobile routed roots use natural document height')
assert.match(appMobile, /padding-bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*var\(--safe-bottom\)\s*\+\s*16px\)/, 'mobile content reserves nav, safe area, and breathing room')
assert.match(
  appMobile,
  /\.page-content\s*\{[^}]*flex:\s*none;[^}]*min-height:\s*auto;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s,
  'mobile shared page content must flow through the authenticated scroller',
)

const digitalMobileStart = digitalHumanCss.lastIndexOf('@media (max-width: 768px)')
const digitalBeforeMobile = digitalHumanCss.slice(0, digitalMobileStart)
for (const selector of ['.live2d-page {', '.live2d-canvas {', '.digital-human-chat {']) {
  assert.ok(digitalBeforeMobile.includes(selector), `digital-human mobile overrides must follow base selector ${selector}`)
}
const digitalMobile = digitalHumanCss.slice(digitalMobileStart)
assert.match(digitalMobile, /\.live2d-page\s*\{[^}]*grid-template-rows:\s*minmax\(220px,\s*42vh\)\s+auto[^}]*overflow:\s*visible/s, 'digital-human mobile stage and chat form a natural stack')
assert.match(digitalMobile, /\.live2d-page\s*\{[^}]*touch-action:\s*pan-y/s, 'digital-human mobile page allows the app shell to own vertical gestures')
assert.match(digitalMobile, /\.live2d-page--presentation\s*\{[^}]*touch-action:\s*pan-y/s, 'digital-human presentation ancestor allows vertical gestures on mobile')
assert.match(digitalMobile, /\.live2d-canvas,[^}]*\.digital-human-stage-glow,[^}]*\.digital-human-status,[^}]*\.live2d-page--presentation::after\s*\{[^}]*grid-row:\s*1[^}]*grid-column:\s*1/s, 'digital-human stage layers stay inside the first grid row')
assert.match(digitalMobile, /\.live2d-canvas\s*\{[^}]*touch-action:\s*none/s, 'only the interactive digital-human canvas keeps exclusive touch handling')
assert.match(digitalMobile, /\.digital-human-chat\s*\{[^}]*grid-row:\s*2[^}]*position:\s*relative[^}]*height:\s*auto/s, 'digital-human chat remains in the second grid row')
assert.match(digitalMobile, /\.digital-human-chat\s*\{[^}]*touch-action:\s*pan-y/s, 'digital-human mobile chat preserves vertical scrolling gestures')
assert.match(digitalBeforeMobile, /\.digital-chat-body\s*\{[^}]*touch-action:\s*pan-y/s, 'digital-human message history preserves local vertical scrolling')
assert.match(digitalBeforeMobile, /\.digital-chat-select__menu\s*\{[^}]*touch-action:\s*pan-y/s, 'digital-human character menu preserves local vertical scrolling')
assert.match(digitalMobile, /\.digital-chat-select\s*\{[^}]*flex:\s*0\s+1\s+auto[^}]*min-width:\s*max-content/s, 'mobile character selector sizes to its complete current value while remaining shrinkable')
assert.doesNotMatch(digitalMobile, /\.digital-chat-select\s*\{[^}]*(?:112px|text-overflow:\s*ellipsis)/s, 'mobile character selector must not force a truncated fixed width')
assert.doesNotMatch(digitalMobile, /\.digital-chat-actions\s*>\s*\.digital-chat-select\s*>\s*button(?:\s+span:first-child)?\s*\{[^}]*(?:112px|text-overflow:\s*ellipsis)/s, 'mobile character value must not be ellipsized or fixed to 112px')
assert.match(digitalMobile, /\.guide-result-card__actions button\s*\{[^}]*min-height:\s*var\(--touch-target\)/s, 'digital-human result actions expose mobile touch targets')

assert.match(mapPage, /map-page--spot-selected/, 'map exposes selected-spot state to responsive CSS')
assert.doesNotMatch(mapPage, /<aside className="map-side"[^>]*aria-hidden/, 'visible desktop map sidebar must remain exposed to assistive technology')
assert.doesNotMatch(mapPage, /style=\{\{\s*left\s*:/s, 'spot card must not directly inline positioning properties')
assert.match(mapPage, /['"]--map-card-left['"]\s*:/, 'spot card exposes its desktop left coordinate through CSS')
assert.match(mapPage, /['"]--map-card-top['"]\s*:/, 'spot card exposes its desktop top coordinate through CSS')
const mapMobile = mapCss.slice(mapCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(mapMobile, /\.map-page\s*\{[^}]*display:\s*grid[^}]*height:\s*auto/s, 'mobile map and services use document flow')
assert.match(mapMobile, /\.map-page__main\s*\{[^}]*height:\s*clamp\(480px,\s*68vh,\s*680px\)/s, 'mobile map has a stable visible height')
assert.match(mapMobile, /\.map-side\s*\{[^}]*position:\s*relative[^}]*inset:\s*auto/s, 'mobile services no longer cover the map')
assert.doesNotMatch(mapMobile, /\.map-side\s*\{[^}]*position:\s*fixed/s, 'mobile services must not be fixed')
assert.match(mapMobile, /\.map-spot-card\s*\{[^}]*position:\s*fixed[^}]*top:\s*auto[^}]*right:\s*12px[^}]*bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*var\(--safe-bottom\)\s*\+\s*12px\)[^}]*left:\s*12px[^}]*max-height:\s*min\(45vh,\s*420px\)[^}]*overflow-y:\s*auto/s, 'selected spot card is a bounded fixed overlay above mobile navigation')
const routeMobile = routeCss.slice(routeCss.lastIndexOf('@media (max-width: 768px)'))
assert.doesNotMatch(routeMobile, /\.route-shell\s*\{[^}]*overflow-y:\s*auto/s, 'mobile route page must defer vertical scrolling to the app shell')
assert.match(routeMobile, /\.route-detail\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s, 'route detail stacks map and content')
assert.match(routeMobile, /\.route-detail__content\s*\{[^}]*position:\s*relative[^}]*overflow:\s*visible/s, 'route summary and timeline remain in flow')
assert.doesNotMatch(routeMobile, /\.route-node:not\(:last-child\)::after\s*\{[^}]*bottom:\s*-\d+px/s, 'timeline connector must not escape its node')
assert.match(routeMobile, /\.route-filter select\s*\{[^}]*min-height:\s*var\(--touch-target\)/s, 'route filters expose mobile touch targets')
assert.match(loginCss, /@media\s*\(max-width:\s*768px\)[\s\S]*\.auth-stage,[\s\S]*\.auth-form\s*\{[^}]*grid-template-columns:\s*1fr/s, 'login form is single-column')
assert.match(loginCss, /@media \(max-width: 768px\), \(max-height: 520px\) and \(pointer: coarse\) \{/)
assert.match(loginCss, /@media \(max-width: 768px\) and \(max-height: 520px\), \(max-height: 520px\) and \(pointer: coarse\) \{/)
const loginMobile = loginCss.slice(loginCss.lastIndexOf('@media (max-width: 768px), (max-height: 520px) and (pointer: coarse) {'))
assert.match(loginMobile, /\.auth-screen--tourism\s*\{[^}]*position:\s*fixed;[^}]*top:\s*var\(--login-viewport-offset-top, 0px\);[^}]*height:\s*var\(--login-viewport-height, 100dvh\);[^}]*overflow:\s*hidden;[^}]*overscroll-behavior:\s*none;/s)
assert.doesNotMatch(loginMobile, /\.auth-screen(?:--tourism)?\s*\{[^}]*overflow-y:\s*auto/s)
assert.doesNotMatch(loginMobile, /\.(?:auth-stage|auth-card(?:--tourism)?|auth-form)\s*\{[^}]*overflow-y:\s*(?:auto|scroll)/s, 'mobile stage, card, and form must never become vertical scroll containers')
assert.doesNotMatch(loginMobile, /touch-action:\s*none/)
assert.match(loginMobile, /\.auth-header-meta,[\s\S]*\.auth-brand-tagline,[\s\S]*\.auth-subtitle-image\s*\{[^}]*display:\s*none;/s)
assert.match(loginMobile, /\.auth-input,[\s\S]*\.auth-form button,[\s\S]*\.auth-input__suffix--clickable\s*\{[^}]*min-height:\s*44px;[^}]*touch-action:\s*manipulation;/s)
assert.match(loginMobile, /\.auth-stage:focus-within[\s\S]*\.login-dh-bubble[\s\S]*display:\s*none/s)
assert.match(loginMobile, /\.auth-stage:focus-within\s*\{[^}]*grid-template-rows:\s*minmax\(0,\s*1fr\);/s)
assert.doesNotMatch(loginMobile, /\.auth-stage:focus-within\s*\{[^}]*grid-template-rows:\s*0\s+minmax\(/s)
assert.match(loginMobile, /\.auth-field\s*\{[^}]*position:\s*relative;[^}]*min-height:\s*44px;/s, 'mobile fields reserve a stable wrapper height')
assert.match(loginMobile, /\.auth-field\s*>\s*\.field-message\s*\{[^}]*position:\s*absolute;/s, 'mobile field errors leave form flow height unchanged')
assert.match(loginMobile, /\.inline-message\s*\{(?=[^}]*overflow-wrap:\s*anywhere;)(?=[^}]*(?:max-height|line-clamp):)/s, 'long server errors wrap and remain height-bounded')
assert.match(loginMobile, /\.auth-stage:focus-within \.auth-card-top[\s\S]*display:\s*none/s, 'focused mobile forms release title decoration space')
assert.match(loginCss, /@media \(max-width: 768px\) and \(max-height: 520px\), \(max-height: 520px\) and \(pointer: coarse\) \{[\s\S]*?\.auth-card-top\s*\{[^}]*display:\s*none;/s, '520px and coarse landscape forms release title decoration space')
for (const essentialSelector of ['.auth-form', '.auth-actions', '.auth-input']) {
  assert.doesNotMatch(loginMobile, new RegExp(`${essentialSelector.replace('.', '\\\.')}[^,{]*[,{][^}]*display:\\s*none`, 's'), `${essentialSelector} must remain visible in focus and compact rules`)
}
assert.match(loginCss, /@media \(max-width: 768px\) and \(max-height: 680px\)/)
assert.match(loginCss, /@media \(max-width: 768px\) and \(max-height: 520px\)/)
const homeMobile = homeCss.slice(homeCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(
  homeMobile,
  /\.hp-scroll\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100%;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s,
  'mobile home content must not create a nested vertical scroller',
)
assert.doesNotMatch(homeMobile, /\.hp-hero\s*\{[^}]*(?:min-)?height:\s*(?:680|800)px/s, 'home hero must not force tall mobile viewport')
assert.match(homeCss, /@media\s*\(max-width:\s*480px\)[\s\S]*\.hp-trip-planner__fields\s*\{[^}]*grid-template-columns:\s*1fr/s, 'small phones use a single-column planner')

const tipsMobile = travelTipsCss.slice(travelTipsCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(
  tipsMobile,
  /\.tips-scroll-area\s*\{[^}]*flex:\s*none;[^}]*min-height:\s*auto;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s,
  'mobile tips content must flow through the authenticated scroller',
)

for (const [name, css] of [
  ['shared page content', appMobile],
  ['home page', homeMobile],
  ['travel tips', tipsMobile],
  ['route page', routeMobile],
]) {
  assert.doesNotMatch(
    css,
    /\.(?:page-content|hp-scroll|tips-scroll-area|route-planner|route-detail__content|route-timeline)\s*\{[^}]*(?:overflow(?:-y)?:\s*(?:auto|scroll)|overscroll-behavior:\s*contain|touch-action:\s*none)/s,
    `${name} must not own mobile page scrolling`,
  )
}

const profileMobile = profileCss.slice(profileCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(profileMobile, /\.profile-grid,[\s\S]*\.profile-stats\s*\{[^}]*grid-template-columns:\s*1fr/s, 'profile cards stack in one column')
assert.match(profileMobile, /\.profile-card__meta\s*\{[^}]*(?:min-width:\s*0|overflow-wrap:\s*anywhere)/s, 'profile identity supports long text')

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
  'LiveBroadcastPage.css',
]

const liveMobile = liveBroadcastCss.slice(liveBroadcastCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(liveMobile, /\.live-broadcast-page__body\s*\{[^}]*grid-template-columns:\s*1fr/s, 'live broadcast stage and interaction stack naturally')
assert.doesNotMatch(liveMobile, /padding-bottom:\s*calc\(var\(--mobile-nav-height\)/, 'live broadcast relies on the shared mobile content safe area')
assert.doesNotMatch(digitalBeforeMobile, /(?:height|min-height):\s*100(?:d)?vh/, 'digital-human desktop layout must size against authenticated content, not the full viewport')

const BOUNDED_LOCAL_SCROLL_ALLOWLIST = [
  ['digital character menu', digitalHumanCss, '.digital-chat-select__menu'],
  ['map spot card', mapMobile, '.map-spot-card'],
  ['live answer history', liveBroadcastCss, '.live-interaction__answer'],
  ['visitor user menu', topNavCss, '.visitor-user-menu__dropdown'],
]

for (const [name, css, selector] of BOUNDED_LOCAL_SCROLL_ALLOWLIST) {
  assert.ok(hasBoundedLocalScroll(css, selector), `${name} must remain bounded and vertically scrollable`)
}

const digitalChatBody = readRules(digitalHumanCss).find((rule) => rule.selector === '.digital-chat-body')?.declarations
assert.equal(digitalChatBody?.get('flex'), '1 1 auto', 'digital chat history consumes bounded flex space')
assert.equal(digitalChatBody?.get('min-height'), '0', 'digital chat history may shrink inside its flex panel')
assert.equal(digitalChatBody?.get('overflow-y'), 'auto', 'digital chat history remains locally scrollable')
assert.ok(
  hasBoundedLocalScroll(readMobileMediaCss(digitalHumanCss), '.digital-chat-body'),
  'mobile digital chat history must have a finite local-scroll boundary',
)

assert.deepEqual(
  readRules(readMobileMediaCss('.desktop { overflow-y: auto; } @media (max-width: 768px) { .mobile-page { overflow-y: auto; } }'))
    .filter((rule) => isVerticalScroller(rule.declarations))
    .map((rule) => rule.selector),
  ['.mobile-page'],
  'mobile scroll scanning ignores desktop declarations and detects new mobile scrollers',
)
assert.ok(
  hasBoundedLocalScroll('.bounded { overflow-y: auto; max-height: 240px; }', '.bounded'),
  'bounded local scroll validation is declaration-order independent',
)
assert.equal(
  hasBoundedLocalScroll('.unbounded { overflow-y: auto; height: auto; }', '.unbounded'),
  false,
  'height auto must not satisfy a bounded local scroll contract',
)

const MOBILE_VERTICAL_SCROLL_ALLOWLIST = new Set([
  'App.css::.authenticated-app__content',
  'MapPage.css::.map-spot-card',
  'DigitalHumanPage.css::.digital-chat-body',
])
const mobileScrollStyles = [
  ['App.css', appCss],
  ['VisitorTopNav.css', topNavCss],
  ...routedPageStyles.map((stylesheet) => [stylesheet, read(`pages/${stylesheet}`)]),
]
const readMobileVerticalScrollers = (styles) => styles.flatMap(([stylesheet, css]) => (
  readRules(readMobileMediaCss(css))
    .filter((rule) => isVerticalScroller(rule.declarations))
    .map((rule) => `${stylesheet}::${rule.selector}`)
))
const findUnexpectedMobileScrollers = (styles) => (
  readMobileVerticalScrollers(styles).filter((entry) => !MOBILE_VERTICAL_SCROLL_ALLOWLIST.has(entry))
)
assert.deepEqual(
  findUnexpectedMobileScrollers([
    ['Fixture.css', '.desktop { overflow-y: auto; } @media (max-width: 480px) { .new-page-scroll { overflow: hidden scroll; } }'],
  ]),
  ['Fixture.css::.new-page-scroll'],
  'a new mobile page-level vertical scroller must be rejected unless explicitly allowlisted',
)
assert.deepEqual(
  readMobileVerticalScrollers(mobileScrollStyles).sort(),
  [...MOBILE_VERTICAL_SCROLL_ALLOWLIST].sort(),
  'mobile vertical scrolling stays exclusive to the page owner and bounded local allowlist',
)

for (const stylesheet of routedPageStyles) {
  assert.match(
    read(`pages/${stylesheet}`),
    /@media\s*\([^)]*max-width:\s*768px/,
    `${stylesheet} must define routed-page mobile behavior`,
  )
}

console.log(`responsive contract passed for ${routedPageStyles.length} routed page styles`)
