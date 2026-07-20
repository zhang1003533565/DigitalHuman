import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const pageDir = path.dirname(new URL(import.meta.url).pathname)
const rootDir = path.resolve(pageDir, '../..')
const apiPath = path.resolve(rootDir, 'api/travelAnalytics.ts')
const panelPath = path.resolve(pageDir, 'TravelAnalyticsAiPanel.tsx')
const pagePath = path.resolve(pageDir, 'TravelAnalyticsPage.tsx')

const read = (targetPath) => readFileSync(targetPath, 'utf8')

test('travel analytics ai api contract exposes exact five metrics and split summary/test routes', () => {
  const apiSource = read(apiPath)

  assert.match(apiSource, /export const TRAVEL_ANALYTICS_AI_METRICS = \[/)
  assert.match(
    apiSource,
    /'popular_attractions'[\s\S]*'average_stay_duration'[\s\S]*'average_spend'[\s\S]*'average_satisfaction'[\s\S]*'common_visitor_segments'/,
  )
  assert.equal((apiSource.match(/'popular_attractions'|'average_stay_duration'|'average_spend'|'average_satisfaction'|'common_visitor_segments'/g) ?? []).length, 5)
  assert.match(apiSource, /getTravelAnalyticsAiConfig/)
  assert.match(apiSource, /getTravelAnalyticsMetricSummary/)
  assert.match(apiSource, /updateTravelAnalyticsAiConfig/)
  assert.match(apiSource, /testTravelAnalyticsMetric/)
  assert.match(apiSource, /axios\.get<TravelAnalyticsMetricResponse>\(`\/api\/admin\/travel-analytics\/metrics\/\$\{metric\}`\)/)
  assert.match(apiSource, /axios\.post<TravelAnalyticsMetricResponse>\(`\/api\/admin\/travel-analytics\/metrics\/\$\{metric\}\/test`\)/)
})

test('travel analytics ai panel keeps observer summaries readable while save and test stay disabled', () => {
  const panelSource = read(panelPath)

  assert.match(panelSource, /游客 ID、昵称和单条记录不会提供给模型/)
  assert.match(panelSource, /Promise\.all\(TRAVEL_ANALYTICS_AI_METRICS\.map\(\(metric\) => getTravelAnalyticsMetricSummary\(metric\)\)\)/)
  assert.doesNotMatch(panelSource, /if \(isObserver\) \{\s*setSummaryMetrics\(\[\]\)/)
  assert.match(panelSource, /disabled=\{isObserver \|\| saving\}/)
  assert.match(panelSource, /<Button type="primary" onClick=\{\(\) => void handleSave\(\)\} disabled=\{isObserver\} loading=\{saving\}>/)
  assert.match(panelSource, /<Select[\s\S]*disabled=\{isObserver\}/)
  assert.match(panelSource, /<Button[\s\S]*disabled=\{isObserver\}[\s\S]*onClick=\{\(\) => void handleTest\(\)\}/)
  assert.match(panelSource, /Observer 角色只能查看当前配置，不能修改开关或执行测试。/)
  assert.match(panelSource, /观察员不能发起后台模型测试/)
  assert.match(panelSource, /结果只展示 validSamples、totalSamples、asOf、warning 和聚合 items/)
})

test('travel analytics page refreshes ai summaries after every successful mutation path', () => {
  const pageSource = read(pagePath)

  assert.match(pageSource, /await deleteTravelAnalyticsRecord\(Number\(record\.__id\)\)[\s\S]*await aiPanelRef\.current\?\.refresh\(\)/)
  assert.match(pageSource, /await importTravelAnalyticsExcel\(file as File, replaceAll,[\s\S]*await aiPanelRef\.current\?\.refresh\(\)/)
  assert.match(pageSource, /await updateTravelAnalyticsRecord\(Number\(editingRow\.__id\), payload\)[\s\S]*await aiPanelRef\.current\?\.refresh\(\)/)
  assert.match(pageSource, /await createTravelAnalyticsRecord\(payload\)[\s\S]*await aiPanelRef\.current\?\.refresh\(\)/)
})
