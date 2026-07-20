import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  VISITOR_THEME_STORAGE_KEY,
  applyVisitorThemeToRoot,
  clearVisitorThemeFromRoot,
  getMillisecondsUntilNextVisitorThemeBoundary,
  readStoredVisitorThemeMode,
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
  return readStoredVisitorThemeMode()
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
    let cancelled = false
    let timer: number | null = null

    const scheduleNextBoundary = () => {
      const timeoutMs = getMillisecondsUntilNextVisitorThemeBoundary(new Date())
      timer = window.setTimeout(() => {
        if (cancelled) return
        setClock(new Date())
        scheduleNextBoundary()
      }, timeoutMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      setClock(new Date())
      if (timer !== null) window.clearTimeout(timer)
      scheduleNextBoundary()
    }

    scheduleNextBoundary()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      cancelled = true
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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
    applyVisitorThemeToRoot(root, mode, effectiveTheme)
    return () => {
      clearVisitorThemeFromRoot(root)
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
