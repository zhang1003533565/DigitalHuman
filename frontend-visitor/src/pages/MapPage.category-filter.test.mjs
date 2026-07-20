import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('MapPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('MapPage.css', import.meta.url), 'utf8')

assert.match(
  page,
  /const categoryCounts = useMemo\([\s\S]*facilities[\s\S]*categoryId[\s\S]*\}, \[facilities\]\)/,
  'category buttons must derive their available point counts from the already-loaded facilities',
)
assert.match(page, /className="map-sidebar__count"/)
assert.match(page, /className="map-category-result" role="status"/)
assert.match(page, /暂无已发布点位/)
assert.match(css, /\.map-category-result\s*\{/)
assert.match(css, /\.map-sidebar__count\s*\{/)

console.log('MapPage category filter feedback contract passed')
