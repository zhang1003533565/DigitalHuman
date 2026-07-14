import {
  ApiOutlined,
  BarChartOutlined,
  BookOutlined,
  BulbOutlined,
  CommentOutlined,
  EnvironmentOutlined,
  HomeOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons'
import { Button, Drawer, Layout, Menu } from 'antd'
import { useEffect, useState } from 'react'
import type { MenuProps } from 'antd'

type AdminSidebarProps = {
  activeKey: string
  displayName: string
  role: string
  onLogout: () => void
  onSelect: (key: string) => void
}

const { Sider } = Layout

const PARENT_MENU_KEYS = new Set(['spots', 'avatar-group'])
const MOBILE_NAV_QUERY = '(max-width: 768px)'

function useMobileNavigation() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_NAV_QUERY).matches)
  useEffect(() => {
    const media = window.matchMedia(MOBILE_NAV_QUERY)
    const update = () => setMobile(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return mobile
}

const menuItems: NonNullable<MenuProps['items']> = [
  { key: 'dashboard', icon: <BarChartOutlined />, label: '数据总览' },
  { key: 'home-config', icon: <HomeOutlined />, label: '首页配置' },
  {
    key: 'spots',
    icon: <EnvironmentOutlined />,
    label: '景点管理',
    children: [
      { key: 'spot-category', label: '景点分类' },
      { key: 'facility-list', label: '全部设施' },
      { key: 'routes', label: '路线管理' },
      { key: 'travel-analytics', label: '旅游数据行为分析' },
      { key: 'scenic-structured', label: '景点结构化数据' },
      { key: 'voice-scripts', label: '景点口播管理' },
    ],
  },
  { key: 'travel-tips', icon: <BulbOutlined />, label: '游览贴士' },
  {
    key: 'avatar-group',
    icon: <RobotOutlined />,
    label: '数字人配置',
    children: [
      { key: 'avatar', label: '基础配置' },
      { key: 'model-emotion', label: '动作配置' },
    ],
  },
  { key: 'feedback', icon: <CommentOutlined />, label: '游客反馈分析' },
  { key: 'live-broadcast', icon: <VideoCameraOutlined />, label: '数字人直播' },
  { key: 'qa', icon: <SearchOutlined />, label: '问答记录查询' },
  { key: 'ai-models', icon: <ApiOutlined />, label: 'AI 模型管理' },
  { key: 'knowledge', icon: <BookOutlined />, label: '知识库对接站' },
]

function getMenuItems(role: string): NonNullable<MenuProps['items']> {
  return role === 'ADMIN'
    ? menuItems
    : menuItems.filter((item) => item?.key !== 'live-broadcast')
}

export default function AdminSidebar({ activeKey, displayName, role, onLogout, onSelect }: AdminSidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mobile = useMobileNavigation()
  const navigation = (
    <Menu theme="dark" mode="inline" selectedKeys={[activeKey]} defaultOpenKeys={['spots', 'avatar-group']} items={getMenuItems(role)}
      onClick={({ key }) => { if (!PARENT_MENU_KEYS.has(key)) { onSelect(key); setDrawerOpen(false) } }} />
  )
  if (mobile) {
    return <>
      <Button className="admin-mobile-menu" type="primary" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)}>菜单</Button>
      <Drawer className="admin-nav-drawer" placement="left" width={280} open={drawerOpen} onClose={() => setDrawerOpen(false)} title="数字人管理后台">
        {navigation}
        <Button block icon={<SettingOutlined />} onClick={() => { onSelect('settings'); setDrawerOpen(false) }}>设置</Button>
        <Button block icon={<UserOutlined />} onClick={onLogout}>退出登录</Button>
      </Drawer>
    </>
  }
  return (
    <Sider width={208} className="admin-sider">
      <div className="admin-brand">
        <span className="admin-brand__mark">云</span>
        <span><strong>景区数字人管理后台</strong><small>SCENIC AI OPS</small></span>
      </div>
      <div className="admin-sider__status"><i />服务集群运行正常</div>
      <div className="admin-sider__nav">
        {navigation}
      </div>
      <div className="admin-sider__footer">
        <div className="admin-sider__account">
          <span className="admin-sider__role">{displayName} · {role}</span>
          <Button icon={<LogoutOutlined />} className="admin-sider__logout" onClick={onLogout}>
            退出登录
          </Button>
        </div>
        <Button
          type={activeKey === 'settings' ? 'primary' : 'text'}
          icon={<SettingOutlined />}
          className="admin-settings-entry"
          onClick={() => onSelect('settings')}
        >
          设置
        </Button>
      </div>
    </Sider>
  )
}
