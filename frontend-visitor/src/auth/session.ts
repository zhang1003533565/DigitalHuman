export type SessionUser = {
  username: string
}

const SESSION_STORAGE_KEY = 'digitalhuman.visitor.user'

export const DEFAULT_AUTH_REDIRECT = '/home'

export function getStoredUser() {
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as SessionUser
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

export function saveUser(username: string) {
  const nextUser = { username }
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser))
  return nextUser
}

export function clearUser() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
}
