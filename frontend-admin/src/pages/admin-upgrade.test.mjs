import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const layout = readFileSync(new URL('./AdminLayout.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('../App.css', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('./OperationsDashboardPage.tsx', import.meta.url), 'utf8')
const feedback = readFileSync(new URL('./FeedbackManagementPage.tsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../components/AdminSidebar.tsx', import.meta.url), 'utf8')

assert.match(layout, /OperationsDashboardPage/)
assert.match(layout, /FeedbackManagementPage/)
assert.match(css, /@media\s*\(max-width:\s*1024px\)/)
assert.match(css, /@media\s*\(max-width:\s*768px\)/)
assert.match(dashboard, /getOperationsOverview/)
assert.match(dashboard, /echarts\.init/)
assert.match(dashboard, /function MetricsRegion/)
assert.match(dashboard, /function RankingsRegion/)
assert.match(dashboard, /function HealthRegion/)
assert.match(dashboard, /RegionError/)
assert.match(dashboard, /\['healthy', 'up', 'ok'\]/)
assert.match(sidebar, /\(max-width: 768px\)/)
assert.match(sidebar, /matchMedia\(MOBILE_NAV_QUERY\)/)
assert.match(feedback, /updateFeedback/)
assert.match(feedback, /Drawer/)

console.log('admin upgrade structure verified')
