import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('MapPage.tsx', import.meta.url), 'utf8')

assert.match(page, /const \[mobileDrawerState, setMobileDrawerState\] = useState<MobileMapDrawerState>\('collapsed'\)/)
assert.match(page, /const \[mobileCategoryOpen, setMobileCategoryOpen\] = useState\(false\)/)
assert.match(page, /<main className="page-shell page-shell--map">/)
assert.match(page, /<section className="page-content page-content--map">/)
assert.match(page, /className="map-mobile-toolbar"/)
assert.match(page, /className="map-mobile-context-actions"/)
assert.match(page, /className={`map-mobile-drawer map-mobile-drawer--\$\{mobileDrawerState\}`}/)
assert.match(page, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="mobile-map-drawer-title"/)
assert.match(page, /event\.key === 'Escape'/)
assert.match(page, /mobileDrawerTriggerRef\.current\?\.focus\(\)/)
assert.match(page, /function clearSearchResults\(\)/)
assert.match(page, /navigate\('\/live'\)/)
assert.match(page, /navigate\(DIGITAL_HUMAN_ROUTE\)/)

console.log('MapPage mobile workbench source contract passed')
