import assert from 'node:assert/strict'
import { apiClient } from '../api/client.ts'
import { getLiveStatus } from '../api/liveBroadcast.ts'
import { getCalibratedNow, resolveCurrentLivePosition, resolveLivePosition } from './liveTimeline.ts'

const items = [
  { itemId: 11, title: '第一条', content: '甲', durationMs: 3_000, sortOrder: 0 },
  { itemId: 22, title: '第二条', content: '乙', durationMs: 2_000, sortOrder: 1 },
]

const status = {
  status: 'live',
  versionId: 7,
  publishedAt: '2026-07-12T04:00:00.000Z',
  totalDurationMs: 5_000,
  items,
}

assert.equal(getCalibratedNow(1_000, 250), 1_250, 'server clock offset calibrates local ticks')

const originalGet = apiClient.get
const ticks = [1_000, 1_100]
apiClient.get = async () => ({
  data: {
    status: 'published',
    serverTime: new Date(2_050).toISOString(),
    versionId: 7,
    publishedAt: status.publishedAt,
    totalDurationMs: 5_000,
    currentItemId: 11,
    currentItemIndex: 0,
    currentItemOffsetMs: 0,
    cycleOffsetMs: 0,
    items: items.map(({ itemId, ...item }) => ({ ...item, id: itemId })),
  },
})
const snapshot = await getLiveStatus({ now: () => ticks.shift() })
apiClient.get = originalGet
assert.equal(snapshot.clockOffsetMs, 1_000, '100ms RTT calibrates against the request midpoint')
assert.equal(snapshot.receivedAtClientMs, 1_100)
assert.equal(resolveCurrentLivePosition(snapshot, Date.parse(status.publishedAt) + 250)?.itemOffsetMs, 1_250)

assert.deepEqual(
  resolveLivePosition(status, Date.parse(status.publishedAt) + 1_250),
  {
    versionId: 7,
    item: items[0],
    itemIndex: 0,
    itemOffsetMs: 1_250,
    cycleOffsetMs: 1_250,
    totalDurationMs: 5_000,
  },
  'joining mid-broadcast resolves the current item',
)

assert.equal(
  resolveLivePosition(status, Date.parse(status.publishedAt) + 3_000)?.item.itemId,
  22,
  'an item boundary belongs to the next item',
)
assert.equal(resolveLivePosition(status, Date.parse(status.publishedAt) + 3_000)?.itemOffsetMs, 0)

assert.equal(
  resolveLivePosition(status, Date.parse(status.publishedAt) + 5_000)?.item.itemId,
  11,
  'the timeline loops to the first item',
)
assert.equal(resolveLivePosition(status, Date.parse(status.publishedAt) + 11_500)?.itemOffsetMs, 1_500)

assert.equal(
  resolveLivePosition(
    { ...status, versionId: 8, totalDurationMs: 3_000, items: [{ ...items[0], itemId: 33 }] },
    Date.parse(status.publishedAt),
  )?.versionId,
  8,
  'a newly published version is reflected without retaining the old timeline',
)
assert.equal(resolveLivePosition({ ...status, status: 'notPublished' }, Date.now()), null)
assert.equal(resolveLivePosition({ ...status, items: [] }, Date.now()), null)
assert.equal(resolveLivePosition(status, Number.NaN), null)
assert.equal(resolveLivePosition(status, Number.MAX_SAFE_INTEGER + 1), null)
assert.equal(
  resolveLivePosition(
    { ...status, publishedAt: new Date(-8_640_000_000_000_000).toISOString() },
    8_640_000_000_000_000,
  ),
  null,
)
assert.equal(resolveLivePosition({ ...status, totalDurationMs: 4_999 }, Date.parse(status.publishedAt)), null)
assert.equal(resolveLivePosition({ ...status, items: [{ ...items[0], durationMs: 1.5 }] }, Date.parse(status.publishedAt)), null)
assert.equal(
  resolveLivePosition({ ...status, items: [{ ...items[0], durationMs: Number.MAX_SAFE_INTEGER }, items[1]] }, Date.parse(status.publishedAt)),
  null,
)

console.log('live timeline tests passed')
