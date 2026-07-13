import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import ts from 'typescript'

const page = readFileSync(new URL('./HistoryPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./HistoryPage.css', import.meta.url), 'utf8')
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
      for (const [property, value] of readDeclarations(block.body)) declarations.set(property, value)
    }
  }
  for (const source of styles) apply(source)
  return declarations
}

const resolveVariable = (value, declarations) => value.replace(
  /var\((--[\w-]+)\)/g,
  (_, property) => declarations.get(property) ?? `var(${property})`,
)

const portraitViewports = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]
const landscapeViewports = [
  { width: 844, height: 390 },
  { width: 932, height: 430 },
]

for (const viewport of [...portraitViewports, ...landscapeViewports]) {
  const historyPage = effectiveDeclarations(
    [appCss, css],
    viewport,
    new Set(['.page-shell', '.history-page', '.authenticated-app__content > .history-page']),
  )
  assert.equal(historyPage.get('--personal-mobile-edge'), '14px', `${viewport.width}x${viewport.height} defines the history edge`)
  assert.equal(
    resolveVariable(historyPage.get('padding-inline') ?? '', historyPage),
    '14px',
    `${viewport.width}x${viewport.height} consumes the 14px history edge`,
  )
}

for (const viewport of portraitViewports) {
  const outer = effectiveDeclarations(
    [appCss, css],
    viewport,
    new Set(['.authenticated-app__content', '.authenticated-app__content:has(> .history-page)']),
  )
  assert.equal(outer.get('padding-bottom'), 'calc(var(--mobile-nav-height) + var(--safe-bottom) + 16px)')
  const nav = effectiveDeclarations([appCss, css], viewport, new Set(['.mobile-bottom-nav']))
  assert.equal(nav.get('display'), 'grid', `${viewport.width}x${viewport.height} shows the mobile nav`)
}

for (const viewport of landscapeViewports) {
  const outer = effectiveDeclarations(
    [appCss, css],
    viewport,
    new Set(['.authenticated-app__content', '.authenticated-app__content:has(> .history-page)']),
  )
  assert.equal(outer.get('overflow-y'), 'auto', `${viewport.width}x${viewport.height} keeps the outer scroller`)
  assert.equal(outer.get('padding-bottom'), '16px', `${viewport.width}x${viewport.height} does not reserve a hidden mobile nav`)
  const nav = effectiveDeclarations([appCss, css], viewport, new Set(['.mobile-bottom-nav']))
  assert.equal(nav.get('display'), 'none', `${viewport.width}x${viewport.height} keeps the mobile nav hidden`)
}

const historyMobileSelectors = []
const collectHistoryMobileSelectors = (source) => {
  for (const block of readTopLevelBlocks(source)) {
    if (block.prelude.startsWith('@media')) {
      collectHistoryMobileSelectors(block.body)
      continue
    }
    for (const selector of block.prelude.split(',').map((value) => value.trim())) {
      if (/\.(?:history-mobile|history-timeline|history-state|history-message)/.test(selector)) historyMobileSelectors.push(selector)
    }
  }
}
collectHistoryMobileSelectors(css)
assert.ok(historyMobileSelectors.length > 0)
for (const selector of historyMobileSelectors) {
  assert.match(selector, /^\.history-page(?:\s|$)/, `mobile selector must be history-page scoped: ${selector}`)
}

const loaderUrl = new URL('./historyMessageLoader.ts', import.meta.url)
assert.ok(existsSync(loaderUrl), 'history loading decisions must be executable outside the React component')
const loaderSource = readFileSync(loaderUrl, 'utf8')
const loaderJavaScript = ts.transpileModule(loaderSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
}).outputText
const { loadHistoryMessages } = await import(`data:text/javascript;base64,${Buffer.from(loaderJavaScript).toString('base64')}`)

const successController = new AbortController()
let receivedSignal
const successResult = await loadHistoryMessages({
  signal: successController.signal,
  request: async (signal) => {
    receivedSignal = signal
    return [{ role: 'assistant', content: '欢迎', timestamp: 1 }]
  },
  isCanceled: () => false,
})
assert.equal(receivedSignal, successController.signal, 'loader forwards the owned abort signal')
assert.deepEqual(successResult, {
  status: 'success',
  messages: [{ role: 'assistant', content: '欢迎', timestamp: 1 }],
})

const requestError = new Error('network unavailable')
const errorResult = await loadHistoryMessages({
  signal: new AbortController().signal,
  request: async () => { throw requestError },
  isCanceled: () => false,
})
assert.deepEqual(errorResult, { status: 'error' }, 'ordinary request failures enter the error state')

const abortController = new AbortController()
const cancellation = new Error('canceled')
abortController.abort()
const abortedResult = await loadHistoryMessages({
  signal: abortController.signal,
  request: async () => { throw cancellation },
  isCanceled: (error) => error === cancellation,
})
assert.deepEqual(abortedResult, { status: 'aborted' }, 'aborted requests never become visible errors')

assert.match(page, /const \[loadState, setLoadState\] = useState<'idle' \| 'loading' \| 'error'>\('idle'\)/)
assert.match(page, /const \[reloadKey, setReloadKey\] = useState\(0\)/)
assert.match(page, /new AbortController\(\)/)
assert.match(page, /loadHistoryMessages<GuideMessage>\(\{[\s\S]*signal:\s*controller\.signal/)
assert.match(page, /request:[\s\S]*axios\.get<GuideMessage\[]>/)
assert.match(page, /result\.status === 'aborted'[\s\S]*return/)
assert.match(page, /result\.status === 'error'[\s\S]*setLoadState\('error'\)/)
assert.match(page, /return \(\) => controller\.abort\(\)/)
assert.match(page, /onClick=\{\(\) => setReloadKey\(\(value\) => value \+ 1\)\}/)
assert.match(page, /\}, \[reloadKey, sessionId\]\)/)
assert.match(page, /className="history-mobile-head"/)
assert.match(page, /className="history-timeline"/)
assert.match(page, /history-message--\$\{message\.role === 'user' \? 'user' : 'assistant'\}/)
assert.match(page, /会话记录加载失败[\s\S]*重试/)
assert.match(css, /\.history-page \.history-message__body\s*\{[^}]*overflow-wrap:\s*anywhere/)

console.log('history mobile timeline contract checks passed')
