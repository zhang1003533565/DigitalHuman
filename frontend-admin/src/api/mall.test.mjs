import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const apiUrl = new URL('./mall.ts', import.meta.url)
const controllerUrl = new URL(
  '../../../backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminMallController.java',
  import.meta.url,
)

test('admin mall api targets the backend admin mall base path', async () => {
  const source = await readFile(apiUrl, 'utf8')

  assert.match(source, /const ADMIN_MALL_BASE = '\/api\/admin\/mall'/)
})

test('admin mall api paths line up with the Java controller mappings', async () => {
  const [api, controller] = await Promise.all([
    readFile(apiUrl, 'utf8'),
    readFile(controllerUrl, 'utf8'),
  ])

  // 控制器类级映射必须与前端基址一致
  assert.match(controller, /@RequestMapping\("\/api\/admin\/mall"\)/)

  const controllerMappings = [
    '@GetMapping("/products")',
    '@PostMapping("/products")',
    '@PutMapping("/products/{id}")',
    '@DeleteMapping("/products/{id}")',
    '@GetMapping("/orders")',
    '@PutMapping("/orders/{id}/status")',
  ]
  for (const mapping of controllerMappings) {
    assert.ok(controller.includes(mapping), `controller missing ${mapping}`)
  }

  // 前端调用的相对路径必须都能在控制器里找到对应映射
  const expectedCalls = [
    '/products`',
    '/products/${id}`',
    '/orders`',
    '/orders/${id}/status`',
  ]
  for (const call of expectedCalls) {
    assert.ok(api.includes(call), `api client missing ${call}`)
  }

  // 图片上传走 multipart，控制器需声明 consumes
  assert.match(controller, /@PostMapping\(value = "\/products\/image", consumes = MediaType\.MULTIPART_FORM_DATA_VALUE\)/)
  assert.match(api, /\/products\/image/)
})

test('admin mall api exposes the order status values the backend accepts', async () => {
  const source = await readFile(apiUrl, 'utf8')

  for (const status of ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']) {
    assert.match(source, new RegExp(`'${status}'`), `missing status ${status}`)
  }
  assert.match(source, /export type MallOrderStatus/)
})

test('admin mall api separates product writes from order reads', async () => {
  const source = await readFile(apiUrl, 'utf8')

  for (const fn of [
    'listProducts',
    'createProduct',
    'updateProduct',
    'deleteProduct',
    'uploadProductImage',
    'listOrders',
    'updateOrderStatus',
  ]) {
    assert.match(source, new RegExp(`export async function ${fn}`), `missing ${fn}`)
  }
})
