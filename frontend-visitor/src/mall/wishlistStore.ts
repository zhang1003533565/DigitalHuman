import { create } from 'zustand'

const STORAGE_KEY = 'digitalhuman.mall.wishlist'

function readFavorites(): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export const useWishlistStore = create<{ ids: string[]; toggle: (id: string) => void }>((set) => ({
  ids: readFavorites(),
  toggle: (id) => set((state) => {
    const ids = state.ids.includes(id) ? state.ids.filter((value) => value !== id) : [...state.ids, id]
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)) } catch { /* In-memory favorites still work when storage is unavailable. */ }
    return { ids }
  }),
}))
