import { ConfigProvider, theme as antdTheme } from 'antd'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from 'react'
import {
  ADMIN_THEME_STORAGE_KEY,
  isAdminThemeMode,
  resolveAdminTheme,
  type AdminThemeMode,
  type ResolvedAdminTheme,
} from './adminTheme'

type AdminThemeContextValue = {
  mode: AdminThemeMode
  effectiveTheme: ResolvedAdminTheme
  setMode: (mode: AdminThemeMode) => void
}

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null)

function getInitialMode(): AdminThemeMode {
  try {
    const storedMode = localStorage.getItem(ADMIN_THEME_STORAGE_KEY)
    return isAdminThemeMode(storedMode) ? storedMode : 'auto'
  } catch {
    return 'auto'
  }
}

export function AdminThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<AdminThemeMode>(getInitialMode)
  const [clock, setClock] = useState(() => new Date())
  const effectiveTheme = resolveAdminTheme(mode, clock)
  const setMode = useCallback((nextMode: AdminThemeMode) => {
    if (nextMode === 'auto') {
      setClock(new Date())
    }
    setModeState(nextMode)
  }, [])

  useEffect(() => {
    if (mode !== 'auto') {
      return undefined
    }
    const timer = window.setInterval(() => setClock(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [mode])

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_THEME_STORAGE_KEY, mode)
    } catch {
      // Browsers with disabled storage still keep the selected theme for this session.
    }
  }, [mode])

  useLayoutEffect(() => {
    document.documentElement.dataset.adminTheme = effectiveTheme
    document.documentElement.dataset.adminThemeMode = mode
    document.documentElement.style.colorScheme = effectiveTheme
  }, [effectiveTheme, mode])

  const value = useMemo(() => ({ mode, effectiveTheme, setMode }), [effectiveTheme, mode, setMode])
  const algorithm = effectiveTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm

  return (
    <AdminThemeContext.Provider value={value}>
      <ConfigProvider
        theme={{
          algorithm,
          token: {
            borderRadius: 6,
            colorPrimary: effectiveTheme === 'dark' ? '#19c4d2' : '#1677d2',
            colorInfo: effectiveTheme === 'dark' ? '#19c4d2' : '#1677d2',
            controlHeight: 38,
            fontFamily: "Inter, 'PingFang SC', 'Microsoft YaHei', sans-serif",
            fontSize: 15,
            fontSizeSM: 15,
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AdminThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminTheme() {
  const context = useContext(AdminThemeContext)
  if (!context) {
    throw new Error('useAdminTheme must be used inside AdminThemeProvider')
  }
  return context
}
