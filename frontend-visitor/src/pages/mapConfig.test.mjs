import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

for (const file of ['MapPage.tsx', 'RouteRecommendPage.tsx']) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  assert.match(source, /code: 'configMissing'/)
  assert.match(source, /code: 'sdkLoadError'/)
  assert.match(source, /mapError\??\.code === 'sdkLoadError'/)
  assert.doesNotMatch(source, /mapError \? <button/)
}

console.log('map configuration error source tests passed')

const mapPage = readFileSync(new URL('MapPage.tsx', import.meta.url), 'utf8')
assert.match(mapPage, /import\s+\{\s*DIGITAL_HUMAN_ROUTE\s*\}\s+from\s+'\.\.\/digitalHuman\/shared'/)
assert.match(mapPage, /live-card__btn--primary[^>]*onClick=\{\(\) => navigate\('\/live'\)\}/s)
assert.match(mapPage, /live-card__btn--ghost[^>]*onClick=\{\(\) => navigate\(DIGITAL_HUMAN_ROUTE\)\}/s)
assert.match(mapPage, /getLiveStatus\(\{ signal: controller\.signal \}\)/)
assert.match(mapPage, /liveStatus === 'live' \? '在线' : liveStatus === 'error' \? '同步失败' : '准备中'/)
assert.doesNotMatch(mapPage, /洗心池有什么特别|灵山大佛多高|附近的吃饭地点/)
