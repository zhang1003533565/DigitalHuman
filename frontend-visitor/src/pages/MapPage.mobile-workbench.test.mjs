import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('MapPage.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('MapPage.css', import.meta.url), 'utf8')
const mapMobile = css.slice(css.indexOf('@media (max-width: 768px)'))

assert.match(page, /<main className="page-shell page-shell--map">/)
assert.match(page, /<section className="page-content page-content--map">/)
assert.match(page, /className="map-mobile-toolbar"/)
assert.match(page, /className="map-mobile-category-trigger"/)
assert.match(page, /id="mobile-map-categories"/)
assert.match(page, /sidebarCategories\.map\(\(category\)/)
assert.match(page, /className="map-sidebar" aria-label="分类筛选"/)
assert.match(
  page,
  /facilityMarkersRef\.current = filteredFacilities\.map[\s\S]*\}, \[filteredFacilities, hasAutoFitFacilities, mapReady, selectedFacility\]\)/,
  'facility markers must rerender when the asynchronous AMap instance becomes ready',
)

assert.doesNotMatch(page, /className="map-side"/)
assert.doesNotMatch(page, /map-mobile-drawer/)
assert.doesNotMatch(page, /renderNearbyCard/)
assert.doesNotMatch(page, /nearbyServiceCategories/)
assert.doesNotMatch(page, /mobileDrawerState/)

assert.match(page, /className="map-spot-card__actions"/)
assert.match(page, /navigate\(`\/routes\?spotId=/)
assert.match(page, /navigate\(liveRoute\)/)
assert.match(page, /navigate\(digitalHumanRoute\)/)
assert.match(page, />\s*观看直播\s*</)
assert.match(page, />\s*AI 讲解\s*</)

assert.match(mapMobile, /\.map-page__main\s*\{[^}]*height:\s*100%[^}]*border-radius:\s*0/s)
assert.match(mapMobile, /\.map-mobile-toolbar\s*\{[^}]*top:\s*var\(--map-mobile-edge\)/s)
assert.match(mapMobile, /\.map-route-context\s*\{[^}]*top:\s*calc\(var\(--map-mobile-edge\)\s*\+\s*var\(--touch-target\)\s*\+\s*10px\)/s)
assert.match(mapMobile, /\.map-controls\s*\{[^}]*right:\s*var\(--map-mobile-edge\)[^}]*bottom:\s*16px/s)
assert.match(mapMobile, /\.map-mobile-context-actions\s*\{[^}]*bottom:\s*16px/s)
assert.match(mapMobile, /\.map-spot-card\s*\{[^}]*bottom:\s*16px/s)
assert.match(mapMobile, /\.map-spot-card__actions\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s)

console.log('MapPage single-entry mobile workbench contract passed')
