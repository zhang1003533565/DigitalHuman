import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const sidebarUrl = new URL('../components/AdminSidebar.tsx', import.meta.url)
const layoutUrl = new URL('./AdminLayout.tsx', import.meta.url)
const metaUrl = new URL('../adminPageMeta.ts', import.meta.url)
const productPageUrl = new URL('./mall/MallProductManagementPage.tsx', import.meta.url)
const orderPageUrl = new URL('./mall/MallOrderManagementPage.tsx', import.meta.url)

test('admin mall pages are registered in page meta, sidebar and layout routing', async () => {
  const [meta, sidebar, layout] = await Promise.all([
    readFile(metaUrl, 'utf8'),
    readFile(sidebarUrl, 'utf8'),
    readFile(layoutUrl, 'utf8'),
  ])

  // 页面 key 必须同时在 meta 与 AdminPageKey 联合类型中声明
  for (const key of ['mall-products', 'mall-orders']) {
    assert.ok(meta.includes(`'${key}'`), `adminPageMeta missing ${key}`)
    assert.ok(layout.includes(`'${key}'`), `AdminLayout path map missing ${key}`)
  }

  // 菜单项与父级分组
  assert.match(sidebar, /label: '景区商城'/)
  assert.match(sidebar, /key: 'mall'/)
  assert.match(sidebar, /PARENT_MENU_KEYS = new Set\(\['spots', 'avatar-group', 'mall'\]\)/)

  // 路由路径与 renderPanel 分发都必须存在，否则页面不可达
  assert.match(layout, /'mall-products': '\/admin\/mall\/products'/)
  assert.match(layout, /'mall-orders': '\/admin\/mall\/orders'/)
  assert.match(layout, /case 'mall-products':\s*return <MallProductManagementPage \/>/)
  assert.match(layout, /case 'mall-orders':\s*return <MallOrderManagementPage \/>/)
})

test('product management page covers create, edit, delete and image upload', async () => {
  const source = await readFile(productPageUrl, 'utf8')

  assert.match(source, /新增商品/)
  assert.match(source, /上传图片/)
  assert.match(source, /uploadProductImage/)
  assert.match(source, /createProduct/)
  assert.match(source, /updateProduct/)
  assert.match(source, /deleteProduct/)
  assert.match(source, /确定删除该商品？/)
  // 农产品与周边产品两个分类都必须可选
  assert.match(source, /MALL_CATEGORY_OPTIONS/)
  assert.match(source, /上架/)
})

test('order management page covers status transitions and cancel reason', async () => {
  const source = await readFile(orderPageUrl, 'utf8')

  assert.match(source, /listOrders/)
  assert.match(source, /updateOrderStatus/)
  assert.match(source, /MALL_ORDER_STATUS_OPTIONS/)
  assert.match(source, /取消原因/)
  assert.match(source, /订单详情/)
  assert.match(source, /收货人/)
  // 已完成/已取消的订单不允许再改状态
  assert.match(source, /const terminal = record\.status === 'COMPLETED' \|\| record\.status === 'CANCELLED'/)
  assert.match(source, /disabled=\{terminal\}/)
})
