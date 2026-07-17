import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('AdminLayout.tsx', import.meta.url), 'utf8')

assert.match(source, /地图配置/)
assert.match(source, /高德地图配置/)
assert.match(source, /数据库存放/)
assert.match(source, /VITE_AMAP_KEY/)
assert.match(source, /VITE_AMAP_SECURITY_KEY/)
assert.match(source, /\/api\/admin\/settings\/map-config/)
assert.match(source, /保存后游客端和管理端地图会在运行时读取新配置/)

console.log('admin map config panel source tests passed')
