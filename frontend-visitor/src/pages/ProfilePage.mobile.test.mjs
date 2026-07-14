import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('./ProfilePage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./ProfilePage.css', import.meta.url), 'utf8')
const appCss = readFileSync(new URL('../App.css', import.meta.url), 'utf8')

const findClosingBrace = (source, openingBrace) => {
  let depth = 1
  for (let index = openingBrace + 1; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return index
  }
  throw new Error(`unclosed CSS block at offset ${openingBrace}`)
}

const readTopLevelBlocks = (source) => {
  const blocks = []
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

const mediaMatches = (prelude, { width, height }) => prelude
  .replace(/^@media\s*/, '')
  .split(',')
  .some((query) => {
    const minWidth = Number(query.match(/min-width\s*:\s*(\d+)px/)?.[1] ?? 0)
    const maxWidth = Number(query.match(/max-width\s*:\s*(\d+)px/)?.[1] ?? Number.POSITIVE_INFINITY)
    const minHeight = Number(query.match(/min-height\s*:\s*(\d+)px/)?.[1] ?? 0)
    const maxHeight = Number(query.match(/max-height\s*:\s*(\d+)px/)?.[1] ?? Number.POSITIVE_INFINITY)
    const orientation = query.match(/orientation\s*:\s*(portrait|landscape)/)?.[1]
    const actualOrientation = width > height ? 'landscape' : 'portrait'
    return width >= minWidth
      && width <= maxWidth
      && height >= minHeight
      && height <= maxHeight
      && (!orientation || orientation === actualOrientation)
  })

const readDeclarations = (body) => (
  [...body.matchAll(/([\w-]+)\s*:\s*([^;{}]+)\s*;/g)].map((match) => [match[1], match[2].trim()])
)

const mergeDeclaration = (declarations, property, value) => {
  if (property === 'overflow') {
    const shorthand = value.split(/\s+/)
    declarations.set('overflow-x', shorthand[0])
    declarations.set('overflow-y', shorthand[1] ?? shorthand[0])
  }
  declarations.set(property, value)
}

const effectiveDeclarations = (styles, viewport, matchingSelectors) => {
  const declarations = new Map()
  const apply = (source) => {
    for (const block of readTopLevelBlocks(source.replaceAll(/\/\*[\s\S]*?\*\//g, ''))) {
      if (block.prelude.startsWith('@media')) {
        if (mediaMatches(block.prelude, viewport)) apply(block.body)
        continue
      }
      if (block.prelude.startsWith('@')) continue
      const selectors = block.prelude.split(',').map((selector) => selector.trim())
      if (!selectors.some((selector) => matchingSelectors.has(selector))) continue
      for (const [property, value] of readDeclarations(block.body)) mergeDeclaration(declarations, property, value)
    }
  }
  for (const source of styles) apply(source)
  return declarations
}

assert.match(page, /className="page-shell profile-page"/)
assert.match(page, /className="profile-identity"/)
assert.match(page, /className="profile-details"/)
assert.match(page, /<dt>用户名<\/dt>/)
assert.match(page, /<dt>显示名称<\/dt>/)
assert.match(page, /<dt>角色<\/dt>/)
assert.match(page, /<section className="profile-stats" aria-label="游客数据">/)
assert.doesNotMatch(page, /className="profile-form__input"/)
assert.doesNotMatch(page, /<input\b/)

assert.match(css, /\.profile-grid\s*\{[^}]*grid-template-columns:\s*280px\s+1fr/)
assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.profile-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/)
assert.match(css, /\.profile-stat-card\s*\{[^}]*min-height:\s*72px[^}]*max-height:\s*84px/)
assert.match(css, /\.profile-identity\s*\{[^}]*grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\)\s+auto/)
assert.match(css, /\.profile-details dl > div\s*\{[^}]*grid-template-columns:\s*88px\s+minmax\(0,\s*1fr\)/)
assert.match(css, /\.profile-page \.page-content\s*\{[^}]*overflow:\s*visible/)
assert.match(css, /@media \(min-width: 769px\) and \(max-width: 932px\) and \(max-height: 520px\) and \(orientation: landscape\)/)
assert.match(css, /\.authenticated-app__content:has\(> \.profile-page\)\s*\{[^}]*overflow-y:\s*auto/)

const mobile = css.slice(css.indexOf('@media (max-width: 768px)'))
assert.doesNotMatch(mobile, /\.(?:profile-grid|profile-main|profile-stats|profile-details)\s*\{[^}]*(?:overflow-y|overflow):\s*(?:auto|scroll)/s)

const landscapeViewports = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
]

for (const viewport of landscapeViewports) {
  const pageShell = effectiveDeclarations(
    [appCss, css],
    viewport,
    new Set(['.page-shell', '.profile-page', '.authenticated-app__content > .profile-page']),
  )
  assert.equal(pageShell.get('padding-inline'), '14px', `${viewport.width}x${viewport.height} keeps the 14px profile edge`)

  const stats = effectiveDeclarations([appCss, css], viewport, new Set(['.profile-page .profile-stats']))
  assert.equal(stats.get('grid-template-columns'), 'repeat(2, minmax(0, 1fr))', `${viewport.width}x${viewport.height} keeps the 2x2 statistics grid`)

  const statCard = effectiveDeclarations([appCss, css], viewport, new Set(['.profile-page .profile-stat-card']))
  assert.equal(statCard.get('min-height'), '72px', `${viewport.width}x${viewport.height} keeps the statistics minimum height`)
  assert.equal(statCard.get('max-height'), '84px', `${viewport.width}x${viewport.height} keeps the statistics maximum height`)

  const outer = effectiveDeclarations(
    [appCss, css],
    viewport,
    new Set(['.authenticated-app__content', '.authenticated-app__content:has(> .profile-page)']),
  )
  assert.equal(outer.get('overflow-y'), 'auto', `${viewport.width}x${viewport.height} keeps authenticated content as the outer scroller`)

  for (const [label, selectors] of [
    ['profile page', ['.page-shell', '.profile-page', '.authenticated-app__content > .profile-page']],
    ['page content', ['.page-content', '.profile-page .page-content']],
    ['profile grid', ['.profile-page .profile-grid']],
    ['profile details', ['.profile-page .profile-details']],
  ]) {
    const declarations = effectiveDeclarations([appCss, css], viewport, new Set(selectors))
    assert.notEqual(declarations.get('overflow-y'), 'auto', `${viewport.width}x${viewport.height} ${label} must not scroll vertically`)
    assert.notEqual(declarations.get('overflow-y'), 'scroll', `${viewport.width}x${viewport.height} ${label} must not scroll vertically`)
    assert.notEqual(declarations.get('overflow'), 'auto', `${viewport.width}x${viewport.height} ${label} must not own overflow`)
    assert.notEqual(declarations.get('overflow'), 'scroll', `${viewport.width}x${viewport.height} ${label} must not own overflow`)
  }

  const identityMeta = effectiveDeclarations([appCss, css], viewport, new Set(['.profile-page .profile-identity__meta']))
  assert.equal(identityMeta.get('min-width'), '0', `${viewport.width}x${viewport.height} identity metadata remains shrinkable`)
  assert.equal(identityMeta.get('overflow-wrap'), 'anywhere', `${viewport.width}x${viewport.height} identity metadata wraps long text`)

  const detailValue = effectiveDeclarations([appCss, css], viewport, new Set(['.profile-page .profile-details dd']))
  assert.equal(detailValue.get('min-width'), '0', `${viewport.width}x${viewport.height} detail values remain shrinkable`)
  assert.equal(detailValue.get('overflow-wrap'), 'anywhere', `${viewport.width}x${viewport.height} detail values wrap long text`)
}

const profileSelectors = []
const collectProfileSelectors = (source) => {
  for (const block of readTopLevelBlocks(source)) {
    if (block.prelude.startsWith('@media')) {
      collectProfileSelectors(block.body)
      continue
    }
    for (const selector of block.prelude.split(',').map((value) => value.trim())) {
      if (/\.profile-(?:grid|identity|main|stats|stat-card|details)/.test(selector)) profileSelectors.push(selector)
    }
  }
}
collectProfileSelectors(css.replaceAll(/\/\*[\s\S]*?\*\//g, ''))
assert.ok(profileSelectors.length > 0)
for (const selector of profileSelectors) {
  assert.match(selector, /^\.profile-page(?:\s|$)/, `profile component selector must be page scoped: ${selector}`)
}

console.log('profile effective cascade, long text, scoping, and scrolling contracts passed')
