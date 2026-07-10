import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sourceUrl = new URL('./HomePage.tsx', import.meta.url)

test('home page exposes the selected AI itinerary experience', async () => {
  const source = await readFile(sourceUrl, 'utf8')

  for (const copy of [
    '今天，想怎样',
    '游灵山',
    '让 AI 规划行程',
    '查看景区地图',
    '今日灵感',
    '为你推荐的路线',
  ]) {
    assert.match(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }

  assert.doesNotMatch(source, /🏯|🚶|👋/)
})
