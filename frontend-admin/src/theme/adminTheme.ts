export type AdminThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedAdminTheme = Exclude<AdminThemeMode, 'auto'>

export const ADMIN_THEME_STORAGE_KEY = 'digital-human.admin-theme-mode'
export const ADMIN_DAY_START_HOUR = 7
export const ADMIN_NIGHT_START_HOUR = 19

export function isAdminThemeMode(value: unknown): value is AdminThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

export function resolveAdminTheme(mode: AdminThemeMode, date = new Date()): ResolvedAdminTheme {
  if (mode !== 'auto') {
    return mode
  }
  const hour = date.getHours()
  return hour >= ADMIN_DAY_START_HOUR && hour < ADMIN_NIGHT_START_HOUR ? 'light' : 'dark'
}
