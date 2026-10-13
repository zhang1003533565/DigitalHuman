import { create } from 'zustand'

export type CartProduct = {
  id: string
  name: string
  price: number
  image?: string | null
  unit?: string | null
  stock: number
}

export type CartItem = {
  productId: string
  name: string
  price: number
  image?: string | null
  unit?: string | null
  stock: number
  quantity: number
}

export const CART_STORAGE_KEY = 'digitalhuman.mall.cart'

export const MAX_QUANTITY_PER_ITEM = 99

type CartState = {
  items: CartItem[]
  addItem: (product: CartProduct, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  syncWithCatalog: (products: CartProduct[]) => void
  clear: () => void
  hydrate: () => void
}

/**
 * 数量上限同时受库存与 99 件硬上限约束，且不允许低于 1。
 */
export function clampQuantity(quantity: number, stock: number) {
  const stockLimit = Number.isFinite(stock) && stock > 0 ? stock : 0
  const upperBound = Math.min(stockLimit, MAX_QUANTITY_PER_ITEM)
  if (upperBound <= 0) {
    return 0
  }
  if (!Number.isFinite(quantity)) {
    return 1
  }
  return Math.max(1, Math.min(Math.floor(quantity), upperBound))
}

function readStoredItems(): CartItem[] {
  if (typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is CartItem => {
        if (!entry || typeof entry !== 'object') return false
        const candidate = entry as Partial<CartItem>
        return (
          typeof candidate.productId === 'string' &&
          typeof candidate.name === 'string' &&
          typeof candidate.price === 'number' &&
          typeof candidate.quantity === 'number'
        )
      })
      .map((entry) => ({ ...entry, quantity: Math.max(1, Math.floor(entry.quantity)) }))
  } catch {
    return []
  }
}

function persist(items: CartItem[]) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // 存储不可用时静默降级，购物车仍在内存中可用
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],

  hydrate: () => {
    set({ items: readStoredItems() })
  },

  addItem: (product, quantity = 1) => {
    const nextQuantity = clampQuantity(quantity, product.stock)
    if (nextQuantity <= 0) {
      return
    }

    const items = [...get().items]
    const index = items.findIndex((item) => item.productId === product.id)
    if (index >= 0) {
      const merged = clampQuantity(items[index].quantity + nextQuantity, product.stock)
      items[index] = {
        ...items[index],
        price: product.price,
        stock: product.stock,
        name: product.name,
        image: product.image,
        unit: product.unit,
        quantity: merged,
      }
    } else {
      items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        unit: product.unit,
        stock: product.stock,
        quantity: nextQuantity,
      })
    }
    persist(items)
    set({ items })
  },

  removeItem: (productId) => {
    const items = get().items.filter((item) => item.productId !== productId)
    persist(items)
    set({ items })
  },

  updateQuantity: (productId, quantity) => {
    const items = get()
      .items
      .map((item) =>
        item.productId === productId
          ? { ...item, quantity: clampQuantity(quantity, item.stock) }
          : item,
      )
      .filter((item) => item.quantity > 0)
    persist(items)
    set({ items })
  },

  /**
   * 用服务端最新商品数据刷新购物车快照：
   * - 已售罄的商品从购物车移除
   * - 价格与库存更新为最新值，数量按新库存重新收敛
   *
   * 重要：products 可能只是当前筛选/搜索命中的子集，
   * 因此**不能**把不在列表里的商品当作已下架删除，否则会误删购物车内容。
   * 下架检测交由下单时的服务端校验负责。
   */
  syncWithCatalog: (products) => {
    const catalog = new Map(products.map((product) => [product.id, product]))
    const items = get()
      .items
      .map((item) => {
        const latest = catalog.get(item.productId)
        // 不在本次列表中的商品保持原样，只更新出现在列表里的
        if (!latest) {
          return item
        }
        if (latest.stock <= 0) {
          return null
        }
        return {
          ...item,
          name: latest.name,
          price: latest.price,
          image: latest.image,
          unit: latest.unit,
          stock: latest.stock,
          quantity: clampQuantity(item.quantity, latest.stock),
        }
      })
      .filter((item): item is CartItem => item !== null && item.quantity > 0)

    persist(items)
    set({ items })
  },

  clear: () => {
    persist([])
    set({ items: [] })
  },
}))

export function selectTotalCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0)
}

export function selectTotalAmount(items: CartItem[]) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return Math.round(total * 100) / 100
}
