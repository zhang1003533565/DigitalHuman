import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const pageDir = path.dirname(new URL(import.meta.url).pathname)
const rootDir = path.resolve(pageDir, '../..')
const apiPath = path.resolve(rootDir, 'api/travelAnalytics.ts')
const panelPath = path.resolve(pageDir, 'TravelAnalyticsAiPanel.tsx')

test('travel analytics ai panel contract is wired', () => {
  const apiSource = readFileSync(apiPath, 'utf8')
  assert.match(apiSource, /getTravelAnalyticsAiConfig/)
  assert.match(apiSource, /updateTravelAnalyticsAiConfig/)
  assert.match(apiSource, /testTravelAnalyticsMetric/)

  assert.equal(existsSync(panelPath), true, 'TravelAnalyticsAiPanel.tsx should exist')
  const panelSource = readFileSync(panelPath, 'utf8')
  assert.match(panelSource, /游客 ID、昵称和单条记录不会提供给模型/)
})
