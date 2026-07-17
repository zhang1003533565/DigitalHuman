import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('SpotCategoryPage.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../api/scenic.ts', import.meta.url), 'utf8')

assert.match(api, /mapVisible: boolean/)
assert.match(api, /mapVisible\?: boolean/)
assert.match(page, /mapVisible\?: boolean/)
assert.match(page, /form\.setFieldsValue\(\{ sortOrder: nextSortOrder, mapVisible: true \}\)/)
assert.match(page, /mapVisible: record\.mapVisible/)
assert.match(page, /dataIndex: 'mapVisible'/)
assert.match(page, /label="游客地图显示" name="mapVisible" valuePropName="checked"/)
assert.match(page, /<Switch checkedChildren="显示" unCheckedChildren="隐藏" \/>/)

console.log('spot category map visibility contract passed')
