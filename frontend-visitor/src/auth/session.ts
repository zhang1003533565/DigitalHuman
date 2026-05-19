import axios from 'axios'

export type SessionUser = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
  token: string
}

const SESSION_STORAGE_KEY = 'digitalhuman.visitor.user'

export const DEFAULT_AUTH_REDIRECT = '/home'

function applyAuthToken(token: string | null) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete axios.defaults.headers.common.Authorization
}

export function getStoredUser() {
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const user = JSON.parse(rawValue) as SessionUser
    applyAuthToken(user.token)
    return user
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    applyAuthToken(null)
    return null
  }
}

export function saveUser(user: SessionUser) {
  const nextUser = user
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser))
  applyAuthToken(nextUser.token)
  return nextUser
}

export function clearUser() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  applyAuthToken(null)
}
