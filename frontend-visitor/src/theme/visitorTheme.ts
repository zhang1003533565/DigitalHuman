export type VisitorThemeMode = 'auto' | 'light' | 'dark'
export type ResolvedVisitorTheme = Exclude<VisitorThemeMode, 'auto'>

export const VISITOR_THEME_STORAGE_KEY = 'digital-human.visitor-theme-mode'
export const VISITOR_DAY_START_HOUR = 7
export const VISITOR_NIGHT_START_HOUR = 19
const VISITOR_THEME_CLASSES = ['visitor-theme--light', 'visitor-theme--dark']
const VISITOR_THEME_MODE_CLASSES = [
  'visitor-theme-mode--auto',
  'visitor-theme-mode--light',
  'visitor-theme-mode--dark',
]

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

export function readStoredVisitorThemeMode(
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage,
): VisitorThemeMode {
  try {
    const storedMode = storage?.getItem(VISITOR_THEME_STORAGE_KEY)
    return isVisitorThemeMode(storedMode) ? storedMode : 'auto'
  } catch {
    return 'auto'
  }
}

export function getMillisecondsUntilNextVisitorThemeBoundary(date = new Date()) {
  const nextBoundary = new Date(date)
  nextBoundary.setMilliseconds(0)

  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()
  const isExactlyOnBoundary = minute === 0 && second === 0 && date.getMilliseconds() === 0

  if (hour < VISITOR_DAY_START_HOUR || (hour === VISITOR_DAY_START_HOUR && !isExactlyOnBoundary && minute === 0 && second === 0)) {
    nextBoundary.setHours(VISITOR_DAY_START_HOUR, 0, 0, 0)
  } else if (hour < VISITOR_NIGHT_START_HOUR || (hour === VISITOR_NIGHT_START_HOUR && !isExactlyOnBoundary && minute === 0 && second === 0)) {
    nextBoundary.setHours(VISITOR_NIGHT_START_HOUR, 0, 0, 0)
  } else {
    nextBoundary.setDate(nextBoundary.getDate() + 1)
    nextBoundary.setHours(VISITOR_DAY_START_HOUR, 0, 0, 0)
  }

  if (nextBoundary <= date) {
    if (hour >= VISITOR_DAY_START_HOUR && hour < VISITOR_NIGHT_START_HOUR) {
      nextBoundary.setHours(VISITOR_NIGHT_START_HOUR, 0, 0, 0)
    } else {
      if (hour >= VISITOR_NIGHT_START_HOUR) nextBoundary.setDate(nextBoundary.getDate() + 1)
      nextBoundary.setHours(VISITOR_DAY_START_HOUR, 0, 0, 0)
    }
  }

  return nextBoundary.getTime() - date.getTime()
}

export function applyVisitorThemeToRoot(
  root: Pick<HTMLElement, 'dataset' | 'style' | 'classList'>,
  mode: VisitorThemeMode,
  effectiveTheme: ResolvedVisitorTheme,
) {
  root.dataset.visitorTheme = effectiveTheme
  root.dataset.visitorThemeMode = mode
  root.style.colorScheme = effectiveTheme
  root.classList.remove(...VISITOR_THEME_CLASSES, ...VISITOR_THEME_MODE_CLASSES)
  root.classList.add(`visitor-theme--${effectiveTheme}`, `visitor-theme-mode--${mode}`)
}

export function clearVisitorThemeFromRoot(root: Pick<HTMLElement, 'dataset' | 'style' | 'classList'>) {
  delete root.dataset.visitorTheme
  delete root.dataset.visitorThemeMode
  root.style.removeProperty('color-scheme')
  root.classList.remove(...VISITOR_THEME_CLASSES, ...VISITOR_THEME_MODE_CLASSES)
}

export function bootstrapVisitorTheme(options?: {
  date?: Date
  root?: Pick<HTMLElement, 'dataset' | 'style' | 'classList'>
  storage?: Pick<Storage, 'getItem'> | null | undefined
}) {
  const mode = readStoredVisitorThemeMode(options?.storage)
  const effectiveTheme = resolveVisitorTheme(mode, options?.date)
  const root = options?.root ?? document.documentElement
  applyVisitorThemeToRoot(root, mode, effectiveTheme)
  return { mode, effectiveTheme }
}
