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

const readDeclarationEntries = (body) => (
  [...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)\s*;/g)].map((match) => [match[1], match[2].trim()])
)

const readDeclarations = (body) => {
  const declarations = new Map()
  for (const [property, value] of readDeclarationEntries(body)) declarations.set(property, value)
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

const readTopLevelBlocks = (css) => {
  const blocks = []
  const source = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
  let cursor = 0
  while (cursor < source.length) {
    const openingBrace = source.indexOf('{', cursor)
    if (openingBrace === -1) break
    const closingBrace = findClosingBrace(source, openingBrace)
    blocks.push({
      prelude: source.slice(cursor, openingBrace).trim(),
      body: source.slice(openingBrace + 1, closingBrace),
    })
    cursor = closingBrace + 1
  }
  return blocks
}

const mediaMatchesWidth = (prelude, width) => prelude
  .replace(/^@media\s*/, '')
  .split(',')
  .some((query) => {
    const minWidth = Number(query.match(/min-width\s*:\s*(\d+(?:\.\d+)?)px/)?.[1] ?? 0)
    const maxWidth = Number(query.match(/max-width\s*:\s*(\d+(?:\.\d+)?)px/)?.[1] ?? Number.POSITIVE_INFINITY)
    return width >= minWidth && width <= maxWidth
  })

const mergeDeclarations = (target, incoming) => {
  for (const [property, value] of incoming) {
    if (property === 'overflow') {
      const shorthand = value.replace(/\s*!important\s*$/, '').split(/\s+/)
      target.set('overflow-x', shorthand[0])
      target.set('overflow-y', shorthand[1] ?? shorthand[0])
    }
    target.set(property, value)
  }
}

const readEffectiveRulesAtWidth = (css, width) => {
  const effectiveRules = new Map()
  const applyRules = (source) => {
    for (const block of readTopLevelBlocks(source)) {
      if (block.prelude.startsWith('@media')) {
        if (mediaMatchesWidth(block.prelude, width)) applyRules(block.body)
        continue
      }
      if (block.prelude.startsWith('@')) continue
      const declarations = readDeclarationEntries(block.body)
      for (const selector of block.prelude.split(',').map((value) => value.trim()).filter(Boolean)) {
        const effective = effectiveRules.get(selector) ?? new Map()
        mergeDeclarations(effective, declarations)
        effectiveRules.set(selector, effective)
      }
    }
  }
  applyRules(css)
  return [...effectiveRules].map(([selector, declarations]) => ({ selector, declarations }))
}

const readMobileRepresentativeWidths = (styles) => {
  const boundaries = new Set([0, 768])
  for (const [, css] of styles) {
    for (const media of css.matchAll(/@media\s*([^{}]+)\{/g)) {
      for (const width of media[1].matchAll(/(?:min|max)-width\s*:\s*(\d+(?:\.\d+)?)px/g)) {
        const value = Number(width[1])
        if (value >= 0 && value <= 768) boundaries.add(value)
      }
    }
  }
  const sortedBoundaries = [...boundaries].sort((left, right) => left - right)
  const representatives = new Set(sortedBoundaries)
  for (let index = 1; index < sortedBoundaries.length; index += 1) {
    const lower = sortedBoundaries[index - 1]
    const upper = sortedBoundaries[index]
    if (upper > lower) representatives.add((lower + upper) / 2)
  }
  return [...representatives].sort((left, right) => left - right)
}

const readComputedOverflow = (declarations) => {
  let overflowX = declarations.get('overflow-x')?.replace(/\s*!important\s*$/, '') ?? 'visible'
  let overflowY = declarations.get('overflow-y')?.replace(/\s*!important\s*$/, '') ?? 'visible'
  const xIsVisibleOrClip = overflowX === 'visible' || overflowX === 'clip'
  const yIsVisibleOrClip = overflowY === 'visible' || overflowY === 'clip'
  if (xIsVisibleOrClip && !yIsVisibleOrClip) overflowX = overflowX === 'visible' ? 'auto' : 'hidden'
  if (yIsVisibleOrClip && !xIsVisibleOrClip) overflowY = overflowY === 'visible' ? 'auto' : 'hidden'
  return { overflowX, overflowY }
}

const isVerticalScroller = (declarations) => {
  const { overflowY } = readComputedOverflow(declarations)
  return overflowY === 'auto' || overflowY === 'scroll'
}

const hasFiniteMaxHeight = (value) => Boolean(
  value
  && !/(?:^|[^\w-])(?:auto|none|initial|inherit|unset|revert|max-content|min-content|fit-content|stretch)(?:$|[^\w-])/i.test(value)
  && !/%/.test(value)
  && (value === '0' || /(?:^|[^\w.-])-?(?:\d+\.?\d*|\.\d+)(?:px|r?em|vh|dvh|svh|lvh)(?:$|[^\w-])/i.test(value)),
)

const hasBoundedLocalScroll = (css, selector) => readRules(css).some((rule) => {
  if (rule.selector !== selector || rule.declarations.get('overflow-y') !== 'auto') return false
  return hasFiniteMaxHeight(rule.declarations.get('max-height'))
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
const effectiveDigitalChatBody = readEffectiveRulesAtWidth(digitalHumanCss, 768)
  .find((rule) => rule.selector === '.digital-chat-body')?.declarations
assert.ok(isVerticalScroller(effectiveDigitalChatBody), 'mobile digital chat history remains locally scrollable')
assert.ok(hasFiniteMaxHeight(effectiveDigitalChatBody?.get('max-height')), 'mobile digital chat history has a finite boundary')

assert.deepEqual(
  readEffectiveRulesAtWidth('.desktop { overflow-y: auto; } @media (max-width: 768px) { .desktop { overflow: visible; } .mobile-page { overflow-y: auto; } }', 768)
    .filter((rule) => isVerticalScroller(rule.declarations))
    .map((rule) => rule.selector),
  ['.mobile-page'],
  'a mobile visible override removes a base scroller while new mobile scrollers remain detectable',
)
assert.deepEqual(
  readEffectiveRulesAtWidth('@media (max-width: 960px) { .tablet-rule { overflow-y: auto; } } @media (max-width: 480px) { .narrow-rule { overflow-y: scroll; } }', 480)
    .filter((rule) => isVerticalScroller(rule.declarations))
    .map((rule) => rule.selector),
  ['.tablet-rule', '.narrow-rule'],
  'all media rules that can apply within mobile widths contribute in source order',
)
const longhandOverride = readEffectiveRulesAtWidth(
  '.content { overflow: auto; } @media (max-width: 768px) { .content { overflow-y: visible; } }',
  768,
).find((rule) => rule.selector === '.content')?.declarations
assert.equal(longhandOverride?.get('overflow-y'), 'visible', 'overflow-y overrides the vertical component of an earlier shorthand')
assert.equal(isVerticalScroller(longhandOverride), true, 'computed overflow-y becomes auto when overflow-x is non-visible')
const fullyVisibleOverflow = readEffectiveRulesAtWidth('.content { overflow: visible; }', 768)
  .find((rule) => rule.selector === '.content')?.declarations
assert.equal(isVerticalScroller(fullyVisibleOverflow), false, 'overflow visible on both axes closes the scroll container')
const twoValueOverflow = readEffectiveRulesAtWidth('.content { overflow: auto visible; }', 768)
  .find((rule) => rule.selector === '.content')?.declarations
assert.equal(isVerticalScroller(twoValueOverflow), true, 'overflow auto visible computes its vertical axis to auto')
assert.ok(
  hasBoundedLocalScroll('.bounded { overflow-y: auto; max-height: 240px; }', '.bounded'),
  'bounded local scroll validation is declaration-order independent',
)
for (const invalidBoundary of ['auto', 'max-content', 'fit-content', '50%']) {
  assert.equal(
    hasBoundedLocalScroll(`.unbounded { overflow-y: auto; max-height: ${invalidBoundary}; }`, '.unbounded'),
    false,
    `${invalidBoundary} must not satisfy a finite local scroll boundary`,
  )
}

const MOBILE_VERTICAL_SCROLL_ALLOWLIST = new Set([
  'App.css::.authenticated-app__content',
  'DigitalHumanPage.css::.digital-chat-select__menu',
  'DigitalHumanPage.css::.digital-chat-body',
  'MapPage.css::.map-spot-card',
  'LiveBroadcastPage.css::.live-interaction__answer',
  'VisitorTopNav.css::.visitor-user-menu__dropdown',
])
const mobileScrollStyles = [
  ['App.css', appCss],
  ['VisitorTopNav.css', topNavCss],
  ...routedPageStyles.map((stylesheet) => [stylesheet, read(`pages/${stylesheet}`)]),
]
const readMobileVerticalScrollers = (styles) => {
  const scrollers = new Set()
  const widths = readMobileRepresentativeWidths(styles)
  for (const [stylesheet, css] of styles) {
    for (const width of widths) {
      for (const rule of readEffectiveRulesAtWidth(css, width)) {
        if (isVerticalScroller(rule.declarations)) scrollers.add(`${stylesheet}::${rule.selector}`)
      }
    }
  }
  return [...scrollers]
}
const findUnexpectedMobileScrollers = (styles) => (
  readMobileVerticalScrollers(styles).filter((entry) => !MOBILE_VERTICAL_SCROLL_ALLOWLIST.has(entry))
)
assert.deepEqual(
  findUnexpectedMobileScrollers([
    ['Fixture.css', '.sixth-local-scroll { max-height: 200px; overflow-y: auto; }'],
  ]),
  ['Fixture.css::.sixth-local-scroll'],
  'a sixth base vertical scroller remains effective on mobile and must be rejected',
)
const rangeOverrideFixture = '.range-scroll { overflow-y: auto; } @media (max-width: 480px) { .range-scroll { overflow: visible; } }'
assert.deepEqual(
  readMobileRepresentativeWidths([['Fixture.css', rangeOverrideFixture]]),
  [0, 240, 480, 624, 768],
  'mobile cascade checks every breakpoint and the interval on each side',
)
assert.deepEqual(
  findUnexpectedMobileScrollers([
    ['Fixture.css', rangeOverrideFixture],
  ]),
  ['Fixture.css::.range-scroll'],
  'a narrow mobile override must not hide a scroller that remains active from 481px through 768px',
)
for (const width of [320, 480]) {
  const rangeScroll = readEffectiveRulesAtWidth(rangeOverrideFixture, width)
    .find((rule) => rule.selector === '.range-scroll')?.declarations
  assert.equal(isVerticalScroller(rangeScroll), false, `the narrow override removes the scroller at ${width}px`)
}
assert.deepEqual(
  readMobileVerticalScrollers(mobileScrollStyles).sort(),
  [...MOBILE_VERTICAL_SCROLL_ALLOWLIST].sort(),
  'effective mobile vertical scrolling stays exclusive to the page owner and five bounded local regions',
)
const effectiveMapSide = readEffectiveRulesAtWidth(mapCss, 768).find((rule) => rule.selector === '.map-side')?.declarations
assert.equal(effectiveMapSide?.get('overflow'), 'visible', 'mobile map services override the desktop local scroller')
assert.equal(isVerticalScroller(effectiveMapSide), false, 'mobile map services do not remain a nested vertical scroller')
for (const [name, css, width, selector] of [
  ['home inspiration rail', homeCss, 480, '.hp-inspiration'],
  ['home route rail', homeCss, 480, '.hp-route-grid'],
  ['tips category bar', travelTipsCss, 768, '.tips-category-bar'],
]) {
  const declarations = readEffectiveRulesAtWidth(css, width).find((rule) => rule.selector === selector)?.declarations
  assert.deepEqual(
    readComputedOverflow(declarations),
    { overflowX: 'auto', overflowY: 'hidden' },
    `${name} keeps horizontal scrolling without becoming a vertical scroller`,
  )
}
for (const [name, css, selector] of [
  ['home page root', homeCss, '.home-page'],
  ['hidden mobile top navigation', topNavCss, '.visitor-topbar__nav'],
]) {
  const declarations = readEffectiveRulesAtWidth(css, 768).find((rule) => rule.selector === selector)?.declarations
  assert.deepEqual(
    readComputedOverflow(declarations),
    { overflowX: 'visible', overflowY: 'visible' },
    `${name} remains non-scrolling on mobile`,
  )
}
const effectiveDigitalChatActions = readEffectiveRulesAtWidth(digitalHumanCss, 768)
  .find((rule) => rule.selector === '.digital-chat-actions')?.declarations
assert.equal(effectiveDigitalChatActions?.get('flex-wrap'), 'wrap', 'mobile digital chat actions wrap on narrow screens')
assert.deepEqual(
  readComputedOverflow(effectiveDigitalChatActions),
  { overflowX: 'visible', overflowY: 'visible' },
  'mobile digital chat actions do not clip absolute menus',
)
const digitalCharacterMenu = readRules(digitalHumanCss)
  .find((rule) => rule.selector === '.digital-chat-select__menu')?.declarations
assert.equal(digitalCharacterMenu?.get('position'), 'absolute', 'digital character menus expand outside the wrapping action row')
assert.ok(hasBoundedLocalScroll(digitalHumanCss, '.digital-chat-select__menu'), 'digital character menus remain bounded local scrollers')

for (const stylesheet of routedPageStyles) {
  assert.match(
    read(`pages/${stylesheet}`),
    /@media\s*\([^)]*max-width:\s*768px/,
    `${stylesheet} must define routed-page mobile behavior`,
  )
}

console.log(`responsive contract passed for ${routedPageStyles.length} routed page styles`)
