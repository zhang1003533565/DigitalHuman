import type { ResolvedVisitorTheme } from './visitorTheme'

export function getVisitorMapStyle(theme: ResolvedVisitorTheme) {
  return theme === 'dark' ? 'amap://styles/darkblue' : 'amap://styles/normal'
}
