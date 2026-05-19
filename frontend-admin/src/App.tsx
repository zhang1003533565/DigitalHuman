import { type FormEvent, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  BarChartOutlined,
  BookOutlined,
  CommentOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  NodeIndexOutlined,
  RobotOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Layout, Menu, Button, Card, Form, Input, Table, Tag, Statistic, Row, Col, Upload, Select } from 'antd'
import type { MenuProps, TableColumnsType } from 'antd'
import './App.css'

const { Header, Sider, Content } = Layout
const SESSION_STORAGE_KEY = 'digitalhuman.admin.user'

type LoginResult = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
  token: string
}

type MenuKey =
  | 'dashboard'
  | 'knowledge'
  | 'spots'
  | 'routes'
  | 'avatar'
  | 'feedback'
  | 'qa'

type SpotRow = {
  key: string
  name: string
  area: string
  openHours: string
  tags: string[]
}

type RouteRow = {
  key: string
  name: string
  suitableFor: string
  duration: string
}

type FeedbackRow = {
  key: string
  question: string
  helpful: string
  rating: string
  comment: string
}

const spotColumns: TableColumnsType<SpotRow> = [
  { title: '景点名称', dataIndex: 'name' },
  { title: '所属园区', dataIndex: 'area' },
  { title: '开放时间', dataIndex: 'openHours' },
  {
    title: '标签',
    dataIndex: 'tags',
    render: (tags: string[]) => tags.map((tag) => <Tag key={tag}>{tag}</Tag>),
  },
]

const routeColumns: TableColumnsType<RouteRow> = [
  { title: '路线名称', dataIndex: 'name' },
  { title: '适合人群', dataIndex: 'suitableFor' },
  { title: '时长', dataIndex: 'duration' },
]

const feedbackColumns: TableColumnsType<FeedbackRow> = [
  { title: '问题', dataIndex: 'question' },
  { title: '帮助情况', dataIndex: 'helpful' },
  { title: '评分', dataIndex: 'rating' },
  { title: '意见', dataIndex: 'comment' },
]

const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <BarChartOutlined />, label: '数据总览' },
  { key: 'knowledge', icon: <BookOutlined />, label: '知识库管理' },
  { key: 'spots', icon: <EnvironmentOutlined />, label: '景点管理' },
  { key: 'routes', icon: <NodeIndexOutlined />, label: '路线管理' },
  { key: 'avatar', icon: <RobotOutlined />, label: '数字人配置' },
  { key: 'feedback', icon: <CommentOutlined />, label: '游客反馈分析' },
  { key: 'qa', icon: <SearchOutlined />, label: '问答记录查询' },
]

function applyAuthToken(token: string | null) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete axios.defaults.headers.common.Authorization
}

function getStoredUser() {
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawValue) {
    applyAuthToken(null)
    return null
  }

  try {
    const user = JSON.parse(rawValue) as LoginResult
    applyAuthToken(user.token)
    return user
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    applyAuthToken(null)
    return null
  }
}

function saveUser(user: LoginResult) {
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user))
  applyAuthToken(user.token)
}

function clearUser() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
  applyAuthToken(null)
}

function DashboardPanel() {
  return (
    <div className="admin-panel-grid">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card><Statistic title="今日服务人次" value={128} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="本周服务人次" value={986} /></Card></Col>
        <Col xs={24} md={8}><Card><Statistic title="负面反馈占比" value={12.4} suffix="%" /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="热门问题 Top3">
            <ul className="admin-list">
              <li>灵山大佛有什么历史？</li>
              <li>亲子路线怎么安排？</li>
              <li>拈花湾晚上适合去吗？</li>
            </ul>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="高频景点关注排行">
            <ul className="admin-list">
              <li>灵山大佛</li>
              <li>九龙灌浴</li>
              <li>拈花塔</li>
            </ul>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function KnowledgePanel() {
  return (
    <Card title="知识库管理" extra={<Button type="primary">上传文档</Button>}>
      <div className="admin-form-grid">
        <Upload>
          <Button icon={<DatabaseOutlined />}>选择景区资料</Button>
        </Upload>
        <div className="admin-inline-meta">
          <Tag color="blue">主知识库 docx</Tag>
          <Tag color="gold">结构化数据 docx</Tag>
          <Tag color="purple">行为分析 xlsx</Tag>
        </div>
      </div>
    </Card>
  )
}

function SpotsPanel() {
  const [data, setData] = useState<SpotRow[]>([])

  useEffect(() => {
    async function loadSpots() {
      const response = await axios.get('/api/admin/scenic/spots')
      setData(
        response.data.map((item: { id: string; name: string; area: string; openHours: string; tags: string[] }) => ({
          key: item.id,
          name: item.name,
          area: item.area,
          openHours: item.openHours,
          tags: item.tags,
        })),
      )
    }

    void loadSpots()
  }, [])

  return (
    <Card title="景点管理" extra={<Button type="primary">新增景点</Button>}>
      <Table columns={spotColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function RoutesPanel() {
  const [data, setData] = useState<RouteRow[]>([])

  useEffect(() => {
    async function loadRoutes() {
      const response = await axios.get('/api/admin/scenic/routes')
      setData(
        response.data.map((item: { id: string; name: string; suitableFor: string; duration: string }) => ({
          key: item.id,
          name: item.name,
          suitableFor: item.suitableFor,
          duration: item.duration,
        })),
      )
    }

    void loadRoutes()
  }, [])

  return (
    <Card title="路线管理" extra={<Button type="primary">创建路线</Button>}>
      <Table columns={routeColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function AvatarPanel() {
  return (
    <Card title="数字人配置">
      <Form layout="vertical">
        <Form.Item label="数字人形象">
          <Select
            options={[
              { value: 'mark', label: 'Mark 中文模型' },
              { value: 'hiyori', label: 'Hiyori 中文模型' },
            ]}
          />
        </Form.Item>
        <Form.Item label="默认音色">
          <Select
            options={[
              { value: 'xiaoxiao', label: '晓晓' },
              { value: 'yunxi', label: '云希' },
            ]}
          />
        </Form.Item>
        <Form.Item label="欢迎词">
          <Input.TextArea rows={4} placeholder="请输入数字人默认欢迎词" />
        </Form.Item>
      </Form>
    </Card>
  )
}

function FeedbackPanel() {
  const [data, setData] = useState<FeedbackRow[]>([])

  useEffect(() => {
    async function loadFeedback() {
      const response = await axios.get('/api/admin/guide/feedback')
      setData(
        response.data.map(
          (item: { sessionId: string; question: string; helpful: boolean; rating: number; comment: string }) => ({
            key: `${item.sessionId}-${item.question}`,
            question: item.question,
            helpful: item.helpful ? '有帮助' : '待优化',
            rating: `${item.rating}/5`,
            comment: item.comment || '-',
          }),
        ),
      )
    }

    void loadFeedback()
  }, [])

  return (
    <Card title="游客反馈分析">
      <Table columns={feedbackColumns} dataSource={data} pagination={false} />
    </Card>
  )
}

function QaPanel() {
  return (
    <Card title="问答记录查询">
      <Form layout="inline" className="admin-filter-row">
        <Form.Item label="关键词">
          <Input placeholder="搜索问题关键词" />
        </Form.Item>
        <Form.Item label="满意度">
          <Select
            style={{ width: 180 }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'good', label: '有帮助' },
              { value: 'bad', label: '待优化' },
            ]}
          />
        </Form.Item>
        <Button type="primary">查询</Button>
      </Form>
    </Card>
  )
}

function renderPanel(activeKey: MenuKey) {
  switch (activeKey) {
    case 'knowledge':
      return <KnowledgePanel />
    case 'spots':
      return <SpotsPanel />
    case 'routes':
      return <RoutesPanel />
    case 'avatar':
      return <AvatarPanel />
    case 'feedback':
      return <FeedbackPanel />
    case 'qa':
      return <QaPanel />
    case 'dashboard':
    default:
      return <DashboardPanel />
  }
}

function LoginView({
  loading,
  error,
  username,
  password,
  setUsername,
  setPassword,
  onSubmit,
}: {
  loading: boolean
  error: string
  username: string
  password: string
  setUsername: (value: string) => void
  setPassword: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">DigitalHuman Admin</p>
        <h1>管理后台登录</h1>
        <p className="lead">
          这一版先完成比赛演示后台骨架，包括总览、知识库、景点、路线、数字人配置、反馈分析和问答查询。
        </p>
        <div className="account-list">
          <div>
            <span>管理员</span>
            <strong>admin / admin123</strong>
          </div>
          <div>
            <span>普通用户</span>
            <strong>user / user123</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <form className="login-form" onSubmit={onSubmit}>
          <label>
            用户名
            <input value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label>
            密码
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          {error ? <p className="message error">{error}</p> : null}
        </form>
      </section>
    </main>
  )
}

function AdminLayout({ user, onLogout }: { user: LoginResult; onLogout: () => void }) {
  const [activeKey, setActiveKey] = useState<MenuKey>('dashboard')
  const pageTitle = useMemo(
    () => {
      const current = menuItems?.find((item) => item && 'key' in item && item.key === activeKey)
      return current && 'label' in current ? current.label : '数据总览'
    },
    [activeKey],
  )

  return (
    <Layout className="admin-shell">
      <Sider width={248} className="admin-sider">
        <div className="admin-brand">
          <strong>数字人管理后台</strong>
          <span>{user.displayName}</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[activeKey]}
          items={menuItems}
          onClick={({ key }) => setActiveKey(key as MenuKey)}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <div>
            <p className="admin-header__eyebrow">Admin Console</p>
            <h1>{pageTitle}</h1>
          </div>
          <div className="admin-header__actions">
            <Tag color="blue">{user.role}</Tag>
            <Button icon={<UserOutlined />} onClick={onLogout}>退出登录</Button>
          </div>
        </Header>
        <Content className="admin-content">{renderPanel(activeKey)}</Content>
      </Layout>
    </Layout>
  )
}

function App() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<LoginResult | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post<LoginResult>('/api/auth/login', {
        username,
        password,
      })

      if (response.data.role !== 'ADMIN') {
        setError('当前入口仅允许管理员登录，请使用管理员账号。')
        setUser(null)
        return
      }

      saveUser(response.data)
      setUser(response.data)
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        setError(submitError.response?.data?.message ?? '登录失败，请检查后端服务和账号密码。')
      } else {
        setError('登录失败，请稍后重试。')
      }
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await axios.delete('/api/auth/logout')
    } catch {
      // Ignore logout failures and clear local session anyway.
    } finally {
      clearUser()
      setUser(null)
    }
  }

  if (!user) {
    return (
      <LoginView
        loading={loading}
        error={error}
        username={username}
        password={password}
        setUsername={setUsername}
        setPassword={setPassword}
        onSubmit={handleSubmit}
      />
    )
  }

  return <AdminLayout user={user} onLogout={handleLogout} />
}

export default App
