import {
  BarChartOutlined,
  BookOutlined,
  CommentOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SearchOutlined,
  SafetyOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'

type AdminSidebarProps = {
  activeKey: string
  displayName: string
  role: string
  onLogout: () => void
  onSelect: (key: string) => void
}

const { Sider } = Layout

const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <BarChartOutlined />, label: '数据总览' },
  { key: 'knowledge', icon: <BookOutlined />, label: '知识库管理' },
  {
    key: 'spots',
    icon: <EnvironmentOutlined />,
    label: '景点管理',
    children: [
      { key: 'spot-category', label: '景点分类' },
      { key: 'facility-list', label: '全部设施' },
    ],
  },
  { key: 'routes', icon: <NodeIndexOutlined />, label: '路线管理' },
  { key: 'avatar', icon: <RobotOutlined />, label: '数字人配置' },
  { key: 'feedback', icon: <CommentOutlined />, label: '游客反馈分析' },
  { key: 'qa', icon: <SearchOutlined />, label: '问答记录查询' },
  { key: 'review', icon: <SafetyOutlined />, label: '人工审核队列' },
  { key: 'travel-analytics', icon: <DatabaseOutlined />, label: '旅游数据行为分析' },
]

export default function AdminSidebar({ activeKey, displayName, role, onLogout, onSelect }: AdminSidebarProps) {
  return (
    <Sider width={248} className="admin-sider">
      <div className="admin-brand">
        <strong>数字人管理后台</strong>
        <span>{displayName}</span>
      </div>
      <div className="admin-sider__nav">
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={({ key }) => {
            if (key === 'spots') {
              return
            }
            onSelect(key)
          }}
        />
      </div>
      <div className="admin-sider__footer">
        <div className="admin-sider__account">
          <span className="admin-sider__role">{role}</span>
          <Button icon={<UserOutlined />} className="admin-sider__logout" onClick={onLogout}>
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
