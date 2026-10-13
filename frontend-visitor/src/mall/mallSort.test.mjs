import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiUrl = new URL('../api/mall.ts', import.meta.url)
const mallPageUrl = new URL('../pages/MallPage.tsx', import.meta.url)
const ordersPageUrl = new URL('../pages/MyOrdersPage.tsx', import.meta.url)

/**
 * api/mall.ts 依赖 axios，无法在 node:test 里直接 import，
 * 因此对源码做契约断言，覆盖排序、折扣与价格区间筛选的关键规则。
 */
test('mall api exposes sort options and the discount helper', async () => {
  const source = await readFile(apiUrl, 'utf8')

  assert.match(source, /export const MALL_SORT_OPTIONS/)
  assert.match(source, /export function discountRate/)
  assert.match(source, /export function sortMallProducts/)
  // 没有划线价或划线价不高于现价时折扣为 0，保证"折扣优先"不会误排
  assert.match(source, /if \(original <= 0 \|\| current <= 0 \|\| original <= current\) return 0/)
})

test('sorting copies the array instead of mutating the caller state', async () => {
  const source = await readFile(apiUrl, 'utf8')

  assert.match(source, /const sorted = \[\.\.\.products\]/)
  // 默认排序原样返回，保持后端给出的综合顺序
  assert.match(source, /if \(sort === 'default'\) \{\s*return products\s*\}/)
})

test('mall api forwards the price range to the product endpoint', async () => {
  const source = await readFile(apiUrl, 'utf8')

  assert.match(source, /minPrice: query\.minPrice != null \? query\.minPrice : undefined/)
  assert.match(source, /maxPrice: query\.maxPrice != null \? query\.maxPrice : undefined/)
  // 旧的 (category, keyword) 两参数调用形式必须继续可用
  assert.match(source, /typeof categoryOrQuery === 'string' \|\| categoryOrQuery === undefined/)
})

test('mall page debounces the price inputs and keeps sorting client-side', async () => {
  const source = await readFile(mallPageUrl, 'utf8')

  assert.match(source, /const \[sortKey, setSortKey\] = useState<MallSortKey>\('default'\)/)
  // 价格输入防抖后再发起请求
  assert.match(source, /setDebouncedPrice\(\{ min: parsePriceBound\(minPriceInput\), max: parsePriceBound\(maxPriceInput\) \}\)/)
  assert.match(source, /const visibleProducts = useMemo\(\(\) => sortMallProducts\(products, sortKey\), \[products, sortKey\]\)/)
  // 渲染的是排序后的列表
  assert.match(source, /visibleProducts\.map\(\(product\) => \{/)
  assert.match(source, /discountRate\(product\)/)
})

test('mall page parses price bounds defensively', async () => {
  const source = await readFile(mallPageUrl, 'utf8')

  // 空串、负数与非数字都不作为筛选条件
  assert.match(source, /const parsed = Number\(trimmed\)/)
  assert.match(source, /if \(!Number\.isFinite\(parsed\) \|\| parsed < 0\) return null/)
})

test('my orders page filters by status and renders a progress trail', async () => {
  const source = await readFile(ordersPageUrl, 'utf8')

  assert.match(source, /const ORDER_STEPS = \[/)
  assert.match(source, /mall-order-steps/)
  // 已取消订单不走进度条，避免出现"已完成"的误导性节点
  assert.match(source, /if \(order\.status === 'CANCELLED'\) \{\s*return null\s*\}/)
  assert.match(source, /const counts = useMemo/)
  assert.match(source, /visibleOrders\.length === 0/)
})
