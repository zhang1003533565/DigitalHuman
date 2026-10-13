import axios from 'axios'

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
  createdAt?: string
  updatedAt?: string
}

export type MallProductPayload = {
  name: string
  category: string
  price: number
  originalPrice?: number | null
  unit?: string | null
  stock?: number
  image?: string | null
  summary?: string | null
  description?: string | null
  tags?: string | null
  sortOrder?: number
  enabled?: boolean
}

export type MallOrderStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'

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
  userId: number
  username: string
  displayName?: string | null
  status: MallOrderStatus | string
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

export type MallMediaUploadResponse = {
  fileName: string
  url: string
}

export const MALL_CATEGORY_OPTIONS = [
  { value: 'farm', label: '农产品' },
  { value: 'souvenir', label: '周边产品' },
]

export const MALL_ORDER_STATUS_OPTIONS: { value: MallOrderStatus; label: string }[] = [
  { value: 'PENDING', label: '待处理' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
]

export const MALL_ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'orange',
  CONFIRMED: 'blue',
  COMPLETED: 'green',
  CANCELLED: 'default',
}

const ADMIN_MALL_BASE = '/api/admin/mall'

export async function listProducts() {
  const response = await axios.get<MallProduct[]>(`${ADMIN_MALL_BASE}/products`)
  return response.data
}

export async function createProduct(payload: MallProductPayload) {
  const response = await axios.post<MallProduct>(`${ADMIN_MALL_BASE}/products`, payload)
  return response.data
}

export async function updateProduct(id: string, payload: MallProductPayload) {
  const response = await axios.put<MallProduct>(`${ADMIN_MALL_BASE}/products/${id}`, payload)
  return response.data
}

export async function deleteProduct(id: string) {
  await axios.delete(`${ADMIN_MALL_BASE}/products/${id}`)
}

export async function uploadProductImage(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await axios.post<MallMediaUploadResponse>(
    `${ADMIN_MALL_BASE}/products/image`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return response.data
}

export async function listOrders() {
  const response = await axios.get<MallOrder[]>(`${ADMIN_MALL_BASE}/orders`)
  return response.data
}

export async function updateOrderStatus(
  id: string,
  status: MallOrderStatus,
  cancelReason?: string,
) {
  const response = await axios.put<MallOrder>(`${ADMIN_MALL_BASE}/orders/${id}/status`, {
    status,
    cancelReason,
  })
  return response.data
}
