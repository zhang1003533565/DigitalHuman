import { type FormEvent, useState } from 'react'
import axios from 'axios'
import './App.css'

type LoginResult = {
  userId: number
  username: string
  displayName: string
  role: 'ADMIN' | 'USER'
}

function App() {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LoginResult | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await axios.post<LoginResult>('http://localhost:8080/api/auth/login', {
        username,
        password,
      })

      setResult(response.data)
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        setError(submitError.response?.data?.message ?? '登录失败，请检查后端服务和账号密码。')
      } else {
        setError('登录失败，请稍后重试。')
      }
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">DigitalHuman Admin</p>
        <h1>后台登录</h1>
        <p className="lead">
          当前页面接入 Java 登录接口，支持管理员和普通用户两种角色。
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
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            用户名
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="请输入用户名"
            />
          </label>

          <label>
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入密码"
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>

          {error ? <p className="message error">{error}</p> : null}
        </form>

        <article className="result-card">
          <p className="result-title">登录结果</p>
          {result ? (
            <>
              <h2>{result.displayName}</h2>
              <p>用户名：{result.username}</p>
              <p>角色：{result.role === 'ADMIN' ? '管理员' : '普通用户'}</p>
              <p>ID：{result.userId}</p>
            </>
          ) : (
            <p className="placeholder">登录成功后会在这里显示用户角色和基本信息。</p>
          )}
        </article>
      </section>
    </main>
  )
}

export default App
