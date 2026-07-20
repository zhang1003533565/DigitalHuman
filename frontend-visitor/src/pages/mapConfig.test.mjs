import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

for (const file of ['MapPage.tsx', 'RouteRecommendPage.tsx']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.doesNotMatch(source, /import\.meta\.env\.VITE_AMAP/)
  assert.match(source, /loadMapConfig\(\)/)
  assert.match(source, /mapConfig\.amapKey/)
  assert.match(source, /mapConfig\.amapSecurityKey/)
  assert.match(source, /code: 'configMissing'/)
  assert.match(source, /code: 'sdkLoadError'/)
}

console.log('map configuration error source tests passed')

const mapPage = readFileSync(new URL('MapPage.tsx', import.meta.url), 'utf8')
assert.match(mapPage, /const selectedFacilityQuery = selectedFacility\s*\?[\s\S]*new URLSearchParams\(\{[\s\S]*spotId:\s*String\(selectedFacility\.id\),[\s\S]*spotName:\s*selectedFacility\.name,[\s\S]*\}\)\.toString\(\)[\s\S]*:\s*''/s)
assert.match(mapPage, /const liveRoute = selectedFacilityQuery \? `\/live\?\$\{selectedFacilityQuery\}` : '\/live'/)
assert.match(mapPage, /const digitalHumanRoute = selectedFacilityQuery[\s\S]*\? `\$\{DIGITAL_HUMAN_ROUTE\}\?\$\{selectedFacilityQuery\}`[\s\S]*: DIGITAL_HUMAN_ROUTE/s)
assert.match(mapPage, /onClick=\{\(\) => navigate\(liveRoute\)\}/)
assert.match(mapPage, /onClick=\{\(\) => navigate\(digitalHumanRoute\)\}/)
assert.match(mapPage, /mapError\.code === 'sdkLoadError'[\s\S]*<button type="button" onClick=\{\(\) => window\.location\.reload\(\)\}>重新加载<\/button>/s)
assert.doesNotMatch(mapPage, /洗心池有什么特别|灵山大佛多高|附近的吃饭地点/)

const routeRecommendPage = readFileSync(new URL('RouteRecommendPage.tsx', import.meta.url), 'utf8')
assert.match(routeRecommendPage, /<span>\{mapError\?\.message \|\| '高德地图加载中，先查看下方行程安排。'\}<\/span>/)
assert.match(routeRecommendPage, /const \[mapRequestVersion, setMapRequestVersion\] = useState\(0\)/)
assert.match(routeRecommendPage, /function handleMapRetry\(\) \{[\s\S]*setMapError\(null\)[\s\S]*resetAMapLoadState\(\)[\s\S]*setMapRequestVersion\(\(current\) => current \+ 1\)/s)
assert.match(routeRecommendPage, /useEffect\(\(\) => \{[\s\S]*loadAMap\(\)[\s\S]*\}, \[mapRequestVersion\]\)/s)
assert.match(routeRecommendPage, /mapError\?\.code === 'sdkLoadError'[\s\S]*onClick=\{handleMapRetry\}[\s\S]*重新加载地图/s)
assert.match(routeRecommendPage, /const AMAP_SCRIPT_SELECTOR = 'script\[data-amap-loader=\"visitor-route-recommend\"\]'/)
assert.match(routeRecommendPage, /function resetAMapLoadState\(doc = document\) \{[\s\S]*amapLoaderPromise = null[\s\S]*querySelectorAll\(AMAP_SCRIPT_SELECTOR\)\.forEach\(\(script\) => script\.remove\(\)\)/s)
