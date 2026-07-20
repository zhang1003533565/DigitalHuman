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
  /const map = new AMap\.Map[\s\S]*requestAnimationFrame\(\(\) => \{\s*map\.resize\?\.\(\)\s*\}\)/,
  'AMap must remeasure after the bounded desktop layout has been painted',
)

console.log('MapPage desktop layout contract passed')
