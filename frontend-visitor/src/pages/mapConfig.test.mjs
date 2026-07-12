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
