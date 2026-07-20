import type { ResolvedVisitorTheme } from './visitorTheme'

export function getVisitorMapStyle(theme: ResolvedVisitorTheme) {
  return theme === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal'
}

type VisitorMapStyleTarget = {
  setMapStyle?: (style: string) => void
}

type VisitorMapThemeErrorHandler = (error: unknown) => void

export function createVisitorMapThemeController<TMap extends VisitorMapStyleTarget>(
  initialTheme: ResolvedVisitorTheme,
  onStyleError?: VisitorMapThemeErrorHandler,
) {
  let mapInstance: TMap | null = null
  let theme = initialTheme

  const getCurrentMapStyle = () => getVisitorMapStyle(theme)

  const syncMapStyle = () => {
    if (!mapInstance) return

    try {
      mapInstance.setMapStyle?.(getCurrentMapStyle())
    } catch (error) {
      onStyleError?.(error)
    }
  }

  return {
    setTheme(nextTheme: ResolvedVisitorTheme) {
      theme = nextTheme
    },
    ensureMap(createMap: (mapStyle: ReturnType<typeof getCurrentMapStyle>) => TMap) {
      if (!mapInstance) {
        mapInstance = createMap(getCurrentMapStyle())
        syncMapStyle()
      }

      return mapInstance
    },
    syncMapStyle,
    detachMap() {
      mapInstance = null
    },
  }
}
