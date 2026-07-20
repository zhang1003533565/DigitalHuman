export type VisitorThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedVisitorTheme = Exclude<VisitorThemeMode, 'auto'>

export const VISITOR_THEME_STORAGE_KEY = 'digital-human.visitor-theme-mode'
export const VISITOR_DAY_START_HOUR = 7
export const VISITOR_NIGHT_START_HOUR = 19

export function isVisitorThemeMode(value: unknown): value is VisitorThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark'
}

export function resolveVisitorTheme(
  mode: VisitorThemeMode,
  date = new Date(),
): ResolvedVisitorTheme {
  if (mode !== 'auto') return mode
  const hour = date.getHours()
  return hour >= VISITOR_DAY_START_HOUR && hour < VISITOR_NIGHT_START_HOUR ? 'light' : 'dark'
}
