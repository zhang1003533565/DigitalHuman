import { apiClient } from './client'

export type MallProductCategory = 'farm' | 'souvenir'

export type MallProduct = {
  id: string
  name: string
  category: MallProductCategory | string
  categoryLabel: string
  price: number
  originalPrice?: number | null
  unit?: string | null
  stock: number
  image?: string | null
  summary?: string | null
  description?: string | null
  tags?: string | null
  sortOrder: number
  enabled: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export type MallOrderItem = {
  productId: string
  productName: string
  productImage?: string | null
  unitPrice: number
  quantity: number
  subtotal: number
}

export type MallOrder = {
  id: string
  status: string
  statusLabel: string
  totalAmount: number
  itemCount: number
  receiverName: string
  receiverPhone: string
  receiverAddress?: string | null
  remark?: string | null
  cancelReason?: string | null
  createdAt: string
  updatedAt: string
  items: MallOrderItem[]
}

export type MallOrderCreatePayload = {
  receiverName: string
  receiverPhone: string
  receiverAddress?: string
  remark?: string
  items: { productId: string; quantity: number }[]
}

export const MALL_CATEGORY_FILTERS = [
  { value: 'all', label: '全部商品' },
  { value: 'farm', label: '农产品' },
  { value: 'souvenir', label: '周边产品' },
]

/** 商城排序方式。排序在客户端完成，避免为一个纯展示偏好增加接口参数。 */
export type MallSortKey = 'default' | 'price-asc' | 'price-desc' | 'discount'

export const MALL_SORT_OPTIONS: { value: MallSortKey; label: string }[] = [
  { value: 'default', label: '综合排序' },
  { value: 'price-asc', label: '价格从低到高' },
  { value: 'price-desc', label: '价格从高到低' },
  { value: 'discount', label: '折扣优先' },
]

/**
 * 折扣力度：相对划线价的降价比例。没有划线价或划线价不高于现价时返回 0，
 * 保证"折扣优先"排序不会把无折扣商品排到前面。
 */
export function discountRate(product: Pick<MallProduct, 'price' | 'originalPrice'>) {
  const original = Number(product.originalPrice ?? 0)
  const current = Number(product.price ?? 0)
  if (!Number.isFinite(original) || !Number.isFinite(current)) return 0
  if (original <= 0 || current <= 0 || original <= current) return 0
  return (original - current) / original
}

export function sortMallProducts(products: MallProduct[], sort: MallSortKey) {
  if (sort === 'default') {
    return products
  }
  // 复制后再排序，避免就地修改传入数组（可能来自 React state）
  const sorted = [...products]
  if (sort === 'price-asc') {
    sorted.sort((a, b) => Number(a.price) - Number(b.price))
  } else if (sort === 'price-desc') {
    sorted.sort((a, b) => Number(b.price) - Number(a.price))
  } else if (sort === 'discount') {
    sorted.sort((a, b) => discountRate(b) - discountRate(a))
  }
  return sorted
}

export const MALL_ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: '待处理',
  CONFIRMED: '已确认',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
}

export type MallProductQuery = {
  category?: string
  keyword?: string
  minPrice?: number | null
  maxPrice?: number | null
}

export async function fetchMallProducts(
  categoryOrQuery?: string | MallProductQuery,
  keyword?: string,
) {
  // 兼容旧的两参数调用形式，同时支持传入完整查询对象
  const query: MallProductQuery =
    typeof categoryOrQuery === 'string' || categoryOrQuery === undefined
      ? { category: categoryOrQuery, keyword }
      : categoryOrQuery

  const response = await apiClient.get<MallProduct[]>('/user/mall/products', {
    params: {
      category: query.category && query.category !== 'all' ? query.category : undefined,
      keyword: query.keyword?.trim() ? query.keyword.trim() : undefined,
      minPrice: query.minPrice != null ? query.minPrice : undefined,
      maxPrice: query.maxPrice != null ? query.maxPrice : undefined,
    },
  })
  return response.data
}

export async function fetchMallProduct(id: string) {
  const response = await apiClient.get<MallProduct>(`/user/mall/products/${id}`)
  return response.data
}

export async function createMallOrder(payload: MallOrderCreatePayload) {
  const response = await apiClient.post<MallOrder>('/user/mall/orders', payload)
  return response.data
}

export async function fetchMyOrders() {
  const response = await apiClient.get<MallOrder[]>('/user/mall/orders')
  return response.data
}

export async function cancelMallOrder(id: string) {
  const response = await apiClient.post<MallOrder>(`/user/mall/orders/${id}/cancel`)
  return response.data
}
