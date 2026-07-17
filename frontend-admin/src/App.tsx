import { type FormEvent, useEffect, useState } from 'react'
import axios from 'axios'
import {
  BankOutlined,
  LockOutlined,
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
  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="景区管理后台">
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
          <h1>景区数字人管理后台</h1>
          <p>统一管理景点、路线、数字人配置与知识库服务</p>
        </div>
      </section>

      <section className="login-workspace">
        <div className="login-top-actions">
          <AdminThemeSwitch />
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
              <input
                autoComplete="username"
                placeholder="请输入用户名"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </span>
          </label>
          <label>
            密码
            <span className="input-shell">
              <LockOutlined />
              <input
                autoComplete="current-password"
                placeholder="请输入密码"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </span>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
          {error ? <p className="message error">{error}</p> : null}
        </form>

        <footer>DigitalHuman Admin · Scenic AI Operations</footer>
      </section>
    </main>
  )
}

function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
