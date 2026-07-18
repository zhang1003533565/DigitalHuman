import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync(new URL('ScenicStructuredPage.tsx', import.meta.url), 'utf8')
const api = readFileSync(new URL('../../api/scenicStructured.ts', import.meta.url), 'utf8')

assert.match(api, /matchedFacilityId/)
assert.match(api, /matchStatus/)
assert.match(api, /applyStatus/)
assert.match(api, /export type ScenicStructuredFieldDiff/)
assert.match(api, /previewScenicStructuredApply/)
assert.match(api, /matchScenicStructuredRecord/)
assert.match(api, /applyScenicStructuredRecord/)
assert.match(api, /apply-preview/)
assert.match(api, /mode: 'fill_empty' \| 'selected' \| 'overwrite_all'/)

assert.match(page, /景点资料导入/)
assert.match(page, /匹配正式景点/)
assert.match(page, /仅填充空字段/)
assert.match(page, /逐字段选择/)
assert.match(page, /覆盖全部资料/)
assert.match(page, /导入数据/)
assert.match(page, /当前正式数据/)
assert.match(page, /previewScenicStructuredApply/)
assert.match(page, /applyScenicStructuredRecord/)
assert.doesNotMatch(page, /游客呈现/)
assert.doesNotMatch(page, /name="audio_enabled"/)
assert.doesNotMatch(page, /name="live_enabled"/)

console.log('scenic structured matching and apply contract passed')
