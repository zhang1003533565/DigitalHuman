import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const storeUrl = new URL('./cartStore.ts', import.meta.url)

/**
 * cartStore 依赖 zustand，无法在 node:test 里直接 import，
 * 因此这里对源码做契约断言，覆盖数量钳制与合计计算的关键规则。
 */
test('cart store exposes the persistence key and quantity guard', async () => {
  const source = await readFile(storeUrl, 'utf8')

  assert.match(source, /CART_STORAGE_KEY = 'digitalhuman\.mall\.cart'/)
  assert.match(source, /MAX_QUANTITY_PER_ITEM = 99/)
  assert.match(source, /export function clampQuantity/)
  assert.match(source, /export function selectTotalCount/)
  assert.match(source, /export function selectTotalAmount/)
})

test('cart store clamps quantity against stock and the 99-piece cap', async () => {
  const source = await readFile(storeUrl, 'utf8')

  // 上限取库存与 99 的较小值，下限为 1
  assert.match(source, /Math\.min\(stockLimit, MAX_QUANTITY_PER_ITEM\)/)
  assert.match(source, /Math\.max\(1, Math\.min\(Math\.floor\(quantity\), upperBound\)\)/)
  // 库存为 0 时返回 0，调用方据此禁用加购
  assert.match(source, /return 0/)
})

test('cart store offers the operations the mall page relies on', async () => {
  const source = await readFile(storeUrl, 'utf8')

  for (const operation of ['addItem', 'removeItem', 'updateQuantity', 'syncWithCatalog', 'clear', 'hydrate']) {
    assert.match(source, new RegExp(`${operation}:`), `missing ${operation}`)
  }
})

test('syncing with the catalog refreshes snapshots without deleting filtered-out items', async () => {
  const source = await readFile(storeUrl, 'utf8')

  // 价格与库存按最新商品刷新
  assert.match(source, /price: latest\.price/)
  assert.match(source, /stock: latest\.stock/)
  // 已售罄的商品移出购物车
  assert.match(source, /if \(latest\.stock <= 0\) \{\s*return null/)
  // 关键：不在本次列表中的商品必须原样保留，否则筛选/搜索会误删购物车内容
  assert.match(source, /if \(!latest\) \{\s*return item\s*\}/)
})

test('mall page debounces the search box instead of firing a request per keystroke', async () => {
  const source = await readFile(new URL('../pages/MallPage.tsx', import.meta.url), 'utf8')

  // URL searches start with their requested keyword; inline edits are still debounced.
  assert.match(source, /const \[debouncedKeyword, setDebouncedKeyword\] = useState\(keyword\)/)
  // 防抖延迟由 DEBOUNCE_MS 常量给出，效果与写死 300 相同
  assert.match(source, /const DEBOUNCE_MS = 300/)
  assert.match(source, /setTimeout\(\(\) => setDebouncedKeyword\(keyword\), DEBOUNCE_MS\)/)
  assert.match(source, /clearTimeout\(timer\)/)
  // 请求依赖防抖后的值，而不是每次输入的原始值
  assert.match(source, /\}, \[activeCategory, debouncedKeyword, debouncedPrice, loadProducts\]\)/)
})

test('cart persists to localStorage and degrades silently when unavailable', async () => {
  const source = await readFile(storeUrl, 'utf8')

  assert.match(source, /localStorage\.setItem\(CART_STORAGE_KEY/)
  assert.match(source, /localStorage\.getItem\(CART_STORAGE_KEY\)/)
  assert.match(source, /catch \{/)
})

test('cart amount is rounded to two decimals', async () => {
  const source = await readFile(storeUrl, 'utf8')

  assert.match(source, /Math\.round\(total \* 100\) \/ 100/)
})
