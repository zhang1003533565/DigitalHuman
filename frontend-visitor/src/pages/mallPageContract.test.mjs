import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const mallPageUrl = new URL('./MallPage.tsx', import.meta.url)
const detailPageUrl = new URL('./MallProductDetailPage.tsx', import.meta.url)
const ordersPageUrl = new URL('./MyOrdersPage.tsx', import.meta.url)
const appUrl = new URL('../App.tsx', import.meta.url)
const apiUrl = new URL('../api/mall.ts', import.meta.url)
const cartDrawerUrl = new URL('../mall/MallCartDrawer.tsx', import.meta.url)
const shellUrl = new URL('../mall/MallShell.tsx', import.meta.url)

test('mall page offers category filters for farm and souvenir products', async () => {
  const [source, api] = await Promise.all([
    readFile(mallPageUrl, 'utf8'),
    readFile(apiUrl, 'utf8'),
  ])

  // 分类文案定义在 API 模块的筛选常量里，页面负责渲染
  assert.match(api, /MALL_CATEGORY_FILTERS/)
  for (const copy of ['农产品', '周边产品']) {
    assert.match(api, new RegExp(copy))
  }
  assert.match(await readFile(shellUrl, 'utf8'), /景区商城/)
  assert.match(source, /MALL_CATEGORY_FILTERS\.map/)
  assert.match(source, /mall-filter--active/)
})

test('shared cart drawer renders quantity controls and checkout fields', async () => {
  const source = await readFile(cartDrawerUrl, 'utf8')

  assert.match(source, /useCartStore/)
  assert.match(await readFile(mallPageUrl, 'utf8'), /加入购物袋/)
  assert.match(source, /提交订单/)
  assert.match(source, /收货人姓名/)
  assert.match(source, /手机号/)
  assert.match(source, /createMallOrder/)
  // 手机号格式与后端 @Pattern(^1\d{10}$) 保持一致
  assert.match(source, /const PHONE_PATTERN = \/\^1\\d\{10\}\$\//)
})

test('mall page guards add-to-cart against sold-out products', async () => {
  const source = await readFile(mallPageUrl, 'utf8')

  assert.match(source, /const soldOut = product\.stock <= 0/)
  assert.match(source, /disabled=\{soldOut\}/)
  assert.match(source, /已售罄/)
})

test('cart drawer surfaces backend business errors instead of swallowing them', async () => {
  const source = await readFile(cartDrawerUrl, 'utf8')

  assert.match(source, /getApiProblem/)
  assert.match(source, /setFormError\(getApiProblem\(submitError\)\.message\)/)
})

test('product detail page clamps quantity to stock and navigates back', async () => {
  const source = await readFile(detailPageUrl, 'utf8')

  assert.match(source, /fetchMallProduct/)
  assert.match(source, /clampQuantity\(MAX_QUANTITY_PER_ITEM, product\.stock\)/)
  assert.match(source, /disabled=\{quantity >= maxQuantity\}/)
  assert.match(source, /立即购买/)
  assert.match(source, /返回商城/)
})

test('my orders page lists orders and allows cancelling pending ones', async () => {
  const source = await readFile(ordersPageUrl, 'utf8')

  assert.match(source, /fetchMyOrders/)
  assert.match(source, /cancelMallOrder/)
  assert.match(source, /我的订单/)
  assert.match(source, /order\.status === 'PENDING'/)
  assert.match(source, /取消订单/)
  assert.match(source, /window\.confirm/)
})

test('visitor routes register the mall pages behind the authenticated shell', async () => {
  const source = await readFile(appUrl, 'utf8')

  assert.match(source, /path="\/mall" element=\{<MallPage \/>\}/)
  assert.match(source, /path="\/mall\/products\/:id" element=\{<MallProductDetailPage \/>\}/)
  assert.match(source, /path="\/orders" element=\{<MyOrdersPage \/>\}/)

  // 商城页面必须在受保护路由组内，未登录访问会被重定向
  const protectedIndex = source.indexOf('<Route element={<ProtectedRoute')
  const mallIndex = source.indexOf('path="/mall"')
  const layoutEndIndex = source.indexOf('<Route path="/live"')
  assert.ok(protectedIndex < mallIndex && mallIndex < layoutEndIndex)
})

test('mall shell keeps one shared top status bar instead of adding a second announcement bar', async () => {
  const source = await readFile(shellUrl, 'utf8')
  assert.doesNotMatch(source, /mall-announcement/)
})
