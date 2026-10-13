import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

// Execute the real stores without a browser or backend. Each fresh module models a reload.
mkdirSync(new URL('../../node_modules/.tmp/', import.meta.url), { recursive: true })
const runtimeDir = mkdtempSync(new URL('../../node_modules/.tmp/mall-runtime-', import.meta.url))
let moduleIndex = 0
async function loadStore(name) {
  const source = readFileSync(new URL(`./${name}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } })
  const path = join(runtimeDir, `${name}-${moduleIndex++}.mjs`)
  writeFileSync(path, compiled.outputText)
  return import(pathToFileURL(path).href)
}

function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
}

test('favorites survive reload and can be removed after reload', async () => {
  globalThis.localStorage = storage()
  const { useWishlistStore } = await loadStore('wishlistStore')
  useWishlistStore.getState().toggle('local-food')
  useWishlistStore.getState().toggle('local-craft')
  const reloaded = (await loadStore('wishlistStore')).useWishlistStore
  assert.deepEqual(reloaded.getState().ids, ['local-food', 'local-craft'])
  reloaded.getState().toggle('local-food')
  assert.deepEqual((await loadStore('wishlistStore')).useWishlistStore.getState().ids, ['local-craft'])
})

test('corrupt saved favorites and invalid IDs do not break the storefront', async () => {
  globalThis.localStorage = storage({ 'digitalhuman.mall.wishlist': '{broken' })
  assert.deepEqual((await loadStore('wishlistStore')).useWishlistStore.getState().ids, [])
  globalThis.localStorage = storage({ 'digitalhuman.mall.wishlist': JSON.stringify(['valid', 7, null, {}]) })
  assert.deepEqual((await loadStore('wishlistStore')).useWishlistStore.getState().ids, ['valid'])
})

test('favorites still work when browser storage is unavailable', async () => {
  globalThis.localStorage = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') } }
  const { useWishlistStore } = await loadStore('wishlistStore')
  assert.doesNotThrow(() => useWishlistStore.getState().toggle('kept-in-memory'))
  assert.deepEqual(useWishlistStore.getState().ids, ['kept-in-memory'])
})

test('repeated quick-add respects stock, persists the bag and computes the total', async () => {
  globalThis.localStorage = storage()
  const { useCartStore, selectTotalAmount, selectTotalCount } = await loadStore('cartStore')
  const product = { id: 'grain', name: '地方谷物', price: 19.9, stock: 3 }
  useCartStore.getState().addItem(product, 2)
  useCartStore.getState().addItem(product, 2)
  assert.equal(selectTotalCount(useCartStore.getState().items), 3)
  assert.equal(selectTotalAmount(useCartStore.getState().items), 59.7)
  const reloaded = (await loadStore('cartStore')).useCartStore
  reloaded.getState().hydrate()
  assert.equal(reloaded.getState().items[0].quantity, 3)
  reloaded.getState().addItem({ ...product, id: 'sold-out', stock: 0 })
  assert.equal(reloaded.getState().items.length, 1)
})

test('filtering the catalog keeps other bag items and synchronizes the changed stock', async () => {
  globalThis.localStorage = storage()
  const { useCartStore } = await loadStore('cartStore')
  const food = { id: 'food', name: '地方风味', price: 20, stock: 10 }
  const craft = { id: 'craft', name: '文创', price: 40, stock: 10 }
  useCartStore.getState().addItem(food, 5)
  useCartStore.getState().addItem(craft, 2)
  useCartStore.getState().syncWithCatalog([{ ...food, price: 18, stock: 2 }])
  assert.equal(useCartStore.getState().items[0].quantity, 2)
  assert.equal(useCartStore.getState().items[0].price, 18)
  assert.equal(useCartStore.getState().items[1].quantity, 2)
  useCartStore.getState().syncWithCatalog([{ ...food, stock: 0 }])
  assert.deepEqual(useCartStore.getState().items.map((item) => item.productId), ['craft'])
})
