import { BellOutlined, CalendarOutlined, DownOutlined, UserOutlined } from '@ant-design/icons'
import { Button, Select } from 'antd'
import type { AdminPageMeta } from '../adminPageMeta'
import AdminThemeSwitch from './AdminThemeSwitch'

export default function AdminTopbar({ page, displayName }: { page: AdminPageMeta; displayName: string }) {
  const today = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return (
    <header className="admin-topbar">
      <div className="admin-topbar__context">
        <Select aria-label="景区选择" defaultValue="yunshanscenic" options={[{ value: 'yunshanscenic', label: '云水山景区' }]} popupMatchSelectWidth={false} />
        <span className="admin-topbar__runtime"><i />实时运行中</span>
      </div>
      <div className="admin-topbar__title" title={page.description}>{page.title}</div>
      <div className="admin-topbar__account">
        <span><CalendarOutlined />{today}</span>
        <AdminThemeSwitch compact />
        <Button aria-label="运行告警" icon={<BellOutlined />}><b>3</b></Button>
        <Button icon={<UserOutlined />}>{displayName}<DownOutlined /></Button>
      </div>
    </header>
  )
}
