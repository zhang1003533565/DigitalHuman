import { type FormEvent, useEffect, useState } from 'react'
import axios from 'axios'
import {
  AimOutlined,
  BankOutlined,
  BellOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DownOutlined,
  EyeInvisibleOutlined,
  FireFilled,
  GlobalOutlined,
  HomeOutlined,
  LineChartOutlined,
  LockOutlined,
  PlaySquareOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons'
import AdminLayout from './pages/AdminLayout'
import AdminThemeSwitch from './components/AdminThemeSwitch'
import type { LoginResult } from './types/admin'
import './App.css'
import './admin-cockpit.css'

const SESSION_STORAGE_KEY = 'digitalhuman.admin.user'

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
  const [remember, setRemember] = useState(true)

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="景区运营概览">
        <header className="login-brand">
          <div className="login-brand__mark">
            <BankOutlined />
          </div>
          <div>
            <strong>景区数字人管理后台</strong>
            <span>DigitalHuman Admin</span>
          </div>
        </header>

        <div className="showcase-copy">
          <h1>让景区运营更智能</h1>
          <p>数据驱动 · AI赋能 · 服务游客 · 提升体验</p>
        </div>

        <div className="dashboard-preview" aria-hidden="true">
          <article className="metric-card metric-card--visitors">
            <div className="metric-card__head">
              <span><TeamOutlined /> 今日游客（人）</span>
              <button type="button">›</button>
            </div>
            <strong>12,826</strong>
            <small>较昨日 ↑ 12.6%</small>
            <div className="sparkline">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="sparkline-labels">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </article>

          <article className="metric-card metric-card--routes">
            <div className="metric-card__head">
              <span><HomeOutlined /> 热门路线 TOP 3</span>
            </div>
            {[
              ['云海栈道线', '8,432'],
              ['峡谷观瀑线', '6,214'],
              ['森林康养线', '4,125'],
            ].map(([name, count], index) => (
              <div className="route-row" key={name}>
                <b>{index + 1}</b>
                <span>{name}</span>
                <em><FireFilled /> {count}</em>
              </div>
            ))}
          </article>

          <article className="metric-card metric-card--hit">
            <div className="metric-card__head">
              <span><LineChartOutlined /> 问答命中率</span>
            </div>
            <div className="donut">
              <strong>92.4%</strong>
            </div>
            <small>较昨日 ↑ 3.7%</small>
          </article>

          <article className="metric-card metric-card--service">
            <div className="metric-card__head">
              <span><SafetyCertificateOutlined /> 服务状态</span>
            </div>
            {[
              ['后端服务', CloudServerOutlined],
              ['AI 服务', RobotOutlined],
              ['数据库', DatabaseOutlined],
            ].map(([label, Icon]) => (
              <div className="service-row" key={label as string}>
                <span>{typeof Icon === 'function' ? <Icon /> : null}{label as string}</span>
                <em><i /> 正常</em>
              </div>
            ))}
          </article>

          <article className="map-card">
            <div className="metric-card__head">
              <span><AimOutlined /> 景区数字孪生地图</span>
            </div>
            <div className="map-stage">
              <div className="map-point map-point--one"><AimOutlined /> 观景台<span>客流 2,341</span></div>
              <div className="map-point map-point--two"><AimOutlined /> 湖中群<span>客流 3,102</span></div>
              <div className="map-point map-point--three"><TeamOutlined /> 避暑馆<span>客流 1,872</span></div>
            </div>
            <div className="map-tabs">
              <span><TeamOutlined /> 客流热力</span>
              <span><PlaySquareOutlined /> 视频监控</span>
              <span><ToolOutlined /> 设备状态</span>
              <span><BellOutlined /> 告警中心</span>
            </div>
          </article>
        </div>
      </section>

      <section className="login-workspace">
        <div className="login-top-actions">
          <AdminThemeSwitch />
          <button className="language-switch" type="button">
            <GlobalOutlined />
            简体中文
            <DownOutlined />
          </button>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <div className="login-form__logo">
            <BankOutlined />
          </div>
          <div className="login-form__title">
            <h2>景区数字人管理后台</h2>
            <p>统一管理景点、路线、数字人配置与知识库服务</p>
          </div>

          <label>
            用户名
            <span className="input-shell">
              <UserOutlined />
              <input value={username} onChange={(event) => setUsername(event.target.value)} />
            </span>
          </label>
          <label>
            密码
            <span className="input-shell">
              <LockOutlined />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <EyeInvisibleOutlined />
            </span>
          </label>

          <div className="form-options">
            <button
              className={`remember-toggle${remember ? ' remember-toggle--checked' : ''}`}
              type="button"
              onClick={() => setRemember((value) => !value)}
              aria-pressed={remember}
            >
              <CheckCircleFilled />
              记住我
            </button>
            <button className="link-button" type="button">忘记密码?</button>
          </div>

          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          {error ? <p className="message error">{error}</p> : null}

          <div className="default-accounts">
            <strong><LockOutlined /> 默认账号（仅供测试使用）</strong>
            <div>
              <span>管理员</span>
              <b>admin / admin123</b>
              <i />
              <span>普通用户</span>
              <b>user / user123</b>
            </div>
          </div>

          <div className="status-strip">
            <span><i /> 后端服务 <b>正常</b></span>
            <span><i /> AI 服务 <b>正常</b></span>
            <span><i /> 数据库 <b>正常</b></span>
          </div>
        </form>

        <footer>DigitalHuman Admin · Scenic AI Operations</footer>
      </section>
    </main>
  )
}

function App() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<LoginResult | null>(() => getStoredUser())

  useEffect(() => {
    document.body.classList.toggle('admin-page', Boolean(user))
    return () => {
      document.body.classList.remove('admin-page')
    }
  }, [user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post<LoginResult>('/api/auth/login', {
        username,
        password,
      })

      if (!['ADMIN', 'OBSERVER'].includes(response.data.role)) {
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
