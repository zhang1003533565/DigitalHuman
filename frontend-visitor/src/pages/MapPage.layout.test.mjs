import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('MapPage.css', import.meta.url), 'utf8')
const page = readFileSync(new URL('MapPage.tsx', import.meta.url), 'utf8')
const desktopCss = css.slice(0, css.indexOf('@media'))

assert.match(
  desktopCss,
  /\.map-page__main\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/s,
  'desktop map stage must fill the bounded map page so AMap receives a non-zero canvas height',
)

assert.match(
  page,
  /const map = mapThemeController\.ensureMap\([\s\S]*requestAnimationFrame\(\(\) => \{\s*map\.resize\?\.\(\)\s*\}\)/,
  'AMap must remeasure after the bounded desktop layout has been painted',
)

assert.match(page, /useVisitorTheme\(\)/, 'MapPage must consume the visitor effective theme')
assert.match(
  page,
  /useLayoutEffect\(\(\) => \{\s*mapThemeControllerRef\.current\.setTheme\(effectiveTheme\)/,
  'MapPage must keep the latest visitor theme available during async SDK loading',
)
assert.match(
  page,
  /createVisitorMapThemeController/,
  'MapPage must use the shared visitor map theme controller',
)
assert.match(
  page,
  /mapThemeControllerRef\.current\.syncMapStyle\(\)/,
  'MapPage must update the existing map style through the shared controller',
)

console.log('MapPage desktop layout contract passed')
