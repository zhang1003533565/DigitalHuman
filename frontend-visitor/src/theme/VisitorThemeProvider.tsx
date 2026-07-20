import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  VISITOR_THEME_STORAGE_KEY,
  isVisitorThemeMode,
  resolveVisitorTheme,
  type ResolvedVisitorTheme,
  type VisitorThemeMode,
} from './visitorTheme'

type VisitorThemeContextValue = {
  mode: VisitorThemeMode
  effectiveTheme: ResolvedVisitorTheme
  setMode: (mode: VisitorThemeMode) => void
}

const VisitorThemeContext = createContext<VisitorThemeContextValue | null>(null)

function getInitialMode(): VisitorThemeMode {
  try {
    const storedMode = localStorage.getItem(VISITOR_THEME_STORAGE_KEY)
    return isVisitorThemeMode(storedMode) ? storedMode : 'auto'
  } catch {
    return 'auto'
  }
}

export function VisitorThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<VisitorThemeMode>(getInitialMode)
  const [clock, setClock] = useState(() => new Date())
  const effectiveTheme = resolveVisitorTheme(mode, clock)
  const setMode = useCallback((nextMode: VisitorThemeMode) => {
    if (nextMode === 'auto') setClock(new Date())
    setModeState(nextMode)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') return undefined
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [mode])

  useEffect(() => {
    try {
      localStorage.setItem(VISITOR_THEME_STORAGE_KEY, mode)
    } catch {
      // The in-memory selection remains active for this session.
    }
  }, [mode])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.visitorTheme = effectiveTheme
    root.dataset.visitorThemeMode = mode
    root.style.colorScheme = effectiveTheme
    return () => {
      delete root.dataset.visitorTheme
      delete root.dataset.visitorThemeMode
      root.style.removeProperty('color-scheme')
    }
  }, [effectiveTheme, mode])

  const value = useMemo(() => ({ mode, effectiveTheme, setMode }), [effectiveTheme, mode, setMode])
  return <VisitorThemeContext.Provider value={value}>{children}</VisitorThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Hook must share the provider's private context.
export function useVisitorTheme() {
  const context = useContext(VisitorThemeContext)
  if (!context) throw new Error('useVisitorTheme must be used inside VisitorThemeProvider')
  return context
}
