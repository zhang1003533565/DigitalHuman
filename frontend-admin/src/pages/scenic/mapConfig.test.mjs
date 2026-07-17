import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('SpotAddPage.tsx', import.meta.url), 'utf8')

assert.doesNotMatch(source, /import\.meta\.env\.VITE_AMAP/)
assert.match(source, /loadMapConfig\(\)/)
assert.match(source, /mapConfig\.amapKey/)
assert.match(source, /mapConfig\.amapSecurityKey/)
assert.match(source, /地图服务未配置/)

console.log('admin scenic map runtime config source tests passed')
