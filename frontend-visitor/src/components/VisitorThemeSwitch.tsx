import { useVisitorTheme } from '../theme/VisitorThemeProvider'
import type { VisitorThemeMode } from '../theme/visitorTheme'

const OPTIONS: Array<{ value: VisitorThemeMode; label: string }> = [
  { value: 'auto', label: '自动' },
  { value: 'light', label: '日间' },
  { value: 'dark', label: '夜间' },
]

export function VisitorThemeSwitch({ placement }: { placement: 'header' | 'menu' }) {
  const { mode, setMode } = useVisitorTheme()

  return (
    <div className={`visitor-theme-switch visitor-theme-switch--${placement}`} role="group" aria-label="主题模式">
      {OPTIONS.map((option) => (
        <button key={option.value} type="button" aria-pressed={mode === option.value} onClick={() => setMode(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}
