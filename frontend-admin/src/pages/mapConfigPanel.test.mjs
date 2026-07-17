import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('AdminLayout.tsx', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../components/AdminSidebar.tsx', import.meta.url), 'utf8')
const meta = readFileSync(new URL('../adminPageMeta.ts', import.meta.url), 'utf8')

assert.match(source, /地图配置/)
assert.match(source, /高德地图配置/)
assert.match(source, /数据库存放/)
assert.match(source, /VITE_AMAP_KEY/)
assert.match(source, /VITE_AMAP_SECURITY_KEY/)
assert.match(source, /\/api\/admin\/settings\/map-config/)
assert.match(source, /保存后游客端和管理端地图会在运行时读取新配置/)
assert.match(source, /'map-config':\s*'\/admin\/map-config'/)
assert.match(source, /case 'map-config':\s*return <MapConfigPanel \/>/)
assert.doesNotMatch(source, /key:\s*'map-config',\s*label:\s*'地图配置'[\s\S]*children:\s*<MapConfigPanel \/>/)
assert.match(sidebar, /key:\s*'knowledge'[\s\S]*label:\s*'知识库对接站'[\s\S]*key:\s*'map-config'[\s\S]*label:\s*'地图配置'/)
assert.match(meta, /'map-config':\s*\{\s*title:\s*'地图配置'/)

console.log('admin map config panel source tests passed')
