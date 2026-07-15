import { ClockCircleOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Segmented } from 'antd'
import type { ReactNode } from 'react'
import { useAdminTheme } from '../theme/AdminThemeProvider'
import type { AdminThemeMode } from '../theme/adminTheme'

export default function AdminThemeSwitch({ compact = false, block = false }: { compact?: boolean; block?: boolean }) {
  const { mode, effectiveTheme, setMode } = useAdminTheme()
  const options: Array<{ value: AdminThemeMode; label: ReactNode }> = [
    { value: 'auto', label: <span title={`自动 · 当前${effectiveTheme === 'light' ? '日间' : '夜间'}`}><ClockCircleOutlined /><b>自动</b></span> },
    { value: 'light', label: <span title="日间主题"><SunOutlined /><b>日间</b></span> },
    { value: 'dark', label: <span title="夜间主题"><MoonOutlined /><b>夜间</b></span> },
  ]

  return (
    <Segmented<AdminThemeMode>
      aria-label="主题模式"
      block={block}
      className={`admin-theme-switch${compact ? ' admin-theme-switch--compact' : ''}`}
      size="small"
      value={mode}
      options={options}
      onChange={setMode}
    />
  )
}
