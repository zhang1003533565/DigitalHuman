import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './LoginPage.css'
import loginBgDayImage from '../assets/login/login.png'
import loginBgNightImage from '../assets/login/login_night.png'
import loginTitleImage from '../assets/login/Tittle.png'
import loginSubtitleImage from '../assets/login/fuTittle.png'
import { DEFAULT_AUTH_REDIRECT, type SessionUser } from '../auth/session'
import {
  LoginDigitalHumanAssistant,
  type LoginDigitalHumanAssistantHandle,
} from '../components/LoginDigitalHumanAssistant'

function UserLineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M5 20a7 7 0 0 1 14 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function LockLineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 10V8a4 4 0 1 1 8 0v2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <rect x="6" y="10" width="12" height="10" rx="1.6" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function EyeOffLineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3l18 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M10.7 10.7A2 2 0 0 0 13.3 13.3" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M9.9 5.2A10.4 10.4 0 0 1 12 5c5.5 0 9.5 5.5 9.5 7 0 1.4-1.1 3-3 4.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M6.4 6.4C3.8 8.1 2.5 10.7 2.5 12c0 1.5 4 7 9.5 7a9.8 9.8 0 0 0 4.2-.9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function EyeLineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.5 12s4-7 9.5-7 9.5 7 9.5 7-4 7-9.5 7-9.5-7-9.5-7Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function CloudLineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 18a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 11a3.5 3.5 0 1 1 0 7Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

type LoginPageProps = {
  user: SessionUser | null
  onLogin: (user: SessionUser) => void
}

export function LoginPage({ user, onLogin }: LoginPageProps) {
  const navigate = useNavigate()
  const assistantRef = useRef<LoginDigitalHumanAssistantHandle | null>(null)
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string
    displayName?: string
    password?: string
    confirmPassword?: string
    form?: string
  }>({})
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const hasTriggeredGreetingRef = useRef(false)
  const isGreetingPlayingRef = useRef(false)
  const redirectTarget = searchParams.get('redirect') || DEFAULT_AUTH_REDIRECT

  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true })
    }
  }, [navigate, redirectTarget, user])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    function handleFirstInteraction() {
      if (hasTriggeredGreetingRef.current || isGreetingPlayingRef.current) {
        return
      }

      const assistant = assistantRef.current

      if (!assistant) {
        return
      }

      isGreetingPlayingRef.current = true
      void assistant.speak({
        text: '你好，欢迎光临。',
        motion: { group: 'Action', index: 6 },
        streamIntervalMs: 70,
      }).then((didPlay) => {
        hasTriggeredGreetingRef.current = didPlay
      }).finally(() => {
        isGreetingPlayingRef.current = false
      })
    }

    window.addEventListener('click', handleFirstInteraction)
    window.addEventListener('keydown', handleFirstInteraction)

    return () => {
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('keydown', handleFirstInteraction)
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: {
      username?: string
      displayName?: string
      password?: string
      confirmPassword?: string
      form?: string
    } = {}

    if (!username.trim()) {
      nextErrors.username = '请输入用户名'
    }

    if (mode === 'register' && !displayName.trim()) {
      nextErrors.displayName = '请输入昵称'
    }

    if (!password.trim()) {
      nextErrors.password = '请输入密码'
    }

    if (mode === 'register' && password.trim() && password.trim().length < 6) {
      nextErrors.password = '密码至少 6 位'
    }

    if (mode === 'register' && !confirmPassword.trim()) {
      nextErrors.confirmPassword = '请确认密码'
    } else if (mode === 'register' && password !== confirmPassword) {
      nextErrors.confirmPassword = '两次密码不一致'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors)
      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await axios.post<SessionUser>(
        mode === 'login' ? '/api/auth/login' : '/api/auth/register',
        mode === 'login'
          ? {
              username: username.trim(),
              password,
            }
          : {
              username: username.trim(),
              password,
              displayName: displayName.trim(),
            },
      )

      if (response.data.role !== 'USER') {
        setFieldErrors({
          form: mode === 'login' ? '当前入口仅允许游客用户登录，请使用用户账号。' : '当前入口仅支持注册游客用户。',
        })
        return
      }

      onLogin(response.data)
      navigate(redirectTarget, { replace: true })
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        setFieldErrors({
          form: submitError.response?.data?.message ?? '登录失败，请检查账号密码或后端服务。',
        })
      } else {
        setFieldErrors({
          form: '登录失败，请稍后重试。',
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const formattedDate = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  }).format(now)

  const formattedTime = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
  const currentHour = now.getHours()
  const isDaytime = currentHour >= 6 && currentHour < 18
  const loginBgImage = isDaytime ? loginBgDayImage : loginBgNightImage
  const handleSuffixKeyDown = (event: KeyboardEvent<HTMLSpanElement>, onToggle: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <main
      className={`auth-screen auth-screen--tourism ${isDaytime ? 'auth-screen--daytime' : 'auth-screen--nighttime'}`}
      style={{
        backgroundImage: isDaytime
          ? `linear-gradient(180deg, rgba(199, 231, 255, 0.18), rgba(103, 171, 224, 0.22) 42%, rgba(7, 24, 49, 0.42)), url(${loginBgImage})`
          : `linear-gradient(180deg, rgba(3, 13, 31, 0.18), rgba(2, 8, 22, 0.6)), url(${loginBgImage})`,
      }}
    >
      <div className="auth-frame">
        <div className="auth-top-trim">
          <span className="auth-top-trim__left"></span>
          <span className="auth-top-trim__center"></span>
          <span className="auth-top-trim__right"></span>
        </div>

        <header className="auth-header">
          <div className="auth-brand">
            <span className="auth-brand-mark">
              <span className="auth-brand-mark__moon"></span>
              <span className="auth-brand-mark__mountain"></span>
            </span>
            <div className="auth-brand-copy">
              <strong>智游山水</strong>
              <p className="auth-brand-tagline">智慧旅行 · 畅游山水</p>
            </div>
          </div>

          <div className="auth-header-meta">
            <span>{formattedDate}</span>
            <span>{formattedTime}</span>
            <span className="auth-weather">
              <CloudLineIcon />
              <span>18°C 多云</span>
            </span>
          </div>
        </header>

        <section className="auth-stage">
          <section className="auth-copy auth-copy--tourism">
            <img src={loginTitleImage} alt="智游山水" className="auth-title-image" />
            <img src={loginSubtitleImage} alt="智享旅程，沉浸山水之美" className="auth-subtitle-image" />
            <LoginDigitalHumanAssistant ref={assistantRef} />
          </section>

          <section className={`auth-card auth-card--tourism ${mode === 'login' ? 'auth-card--login-compact' : ''}`}>
            <span className="auth-card-corner auth-card-corner--lt"></span>
            <span className="auth-card-corner auth-card-corner--rt"></span>
            <span className="auth-card-corner auth-card-corner--lb"></span>
            <span className="auth-card-corner auth-card-corner--rb"></span>
            <div className="auth-card-top">
              <div className="auth-card-title-line">
                <span></span>
                <p className="panel-label">{mode === 'login' ? '用户登录' : '用户注册'}</p>
                <span></span>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-input">
                <span className="sr-only">用户名</span>
                <span className="auth-input__icon"><UserLineIcon /></span>
                <input
                  value={username}
                  onChange={(event) => {
                    setUsername(event.target.value)
                    setFieldErrors((current) => ({ ...current, username: undefined, form: undefined }))
                  }}
                  placeholder="请输入用户名"
                />
              </label>
              {fieldErrors.username ? <p className="field-message">{fieldErrors.username}</p> : null}

              {mode === 'register' ? (
                <>
                  <label className="auth-input">
                    <span className="sr-only">昵称</span>
                    <span className="auth-input__icon"><UserLineIcon /></span>
                    <input
                      value={displayName}
                      onChange={(event) => {
                        setDisplayName(event.target.value)
                        setFieldErrors((current) => ({ ...current, displayName: undefined, form: undefined }))
                      }}
                      placeholder="请输入昵称"
                    />
                  </label>
                  {fieldErrors.displayName ? <p className="field-message">{fieldErrors.displayName}</p> : null}
                </>
              ) : null}

              <label className="auth-input">
                <span className="sr-only">密码</span>
                <span className="auth-input__icon"><LockLineIcon /></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setFieldErrors((current) => ({ ...current, password: undefined, confirmPassword: undefined, form: undefined }))
                  }}
                  placeholder="请输入密码"
                />
                <span
                  className="auth-input__suffix auth-input__suffix--clickable"
                  role="button"
                  tabIndex={0}
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword((current) => !current)}
                  onKeyDown={(event) => handleSuffixKeyDown(event, () => setShowPassword((current) => !current))}
                >
                  {showPassword ? <EyeLineIcon /> : <EyeOffLineIcon />}
                </span>
              </label>
              {fieldErrors.password ? <p className="field-message">{fieldErrors.password}</p> : null}

              {mode === 'register' ? (
                <>
                  <label className="auth-input">
                    <span className="sr-only">确认密码</span>
                    <span className="auth-input__icon"><LockLineIcon /></span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value)
                        setFieldErrors((current) => ({ ...current, confirmPassword: undefined, form: undefined }))
                      }}
                      placeholder="请再次输入密码"
                    />
                    <span
                      className="auth-input__suffix auth-input__suffix--clickable"
                      role="button"
                      tabIndex={0}
                      aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      onKeyDown={(event) => handleSuffixKeyDown(event, () => setShowConfirmPassword((current) => !current))}
                    >
                      {showConfirmPassword ? <EyeLineIcon /> : <EyeOffLineIcon />}
                    </span>
                  </label>
                  {fieldErrors.confirmPassword ? <p className="field-message">{fieldErrors.confirmPassword}</p> : null}
                </>
              ) : null}

              {mode === 'login' ? (
                <div className="auth-actions auth-actions--inline">
                  <button
                    type="button"
                    className="auth-link-button"
                    onClick={() => {
                      setMode('register')
                      setFieldErrors({})
                    }}
                  >
                    没有账号？去注册
                  </button>
                  <button type="submit" className="auth-submit-button auth-submit-button--inline" disabled={submitting}>
                    {submitting ? '登录中...' : '登录'}
                  </button>
                </div>
              ) : (
                <div className="auth-actions auth-actions--inline">
                  <button
                    type="button"
                    className="auth-link-button"
                    onClick={() => {
                      setMode('login')
                      setFieldErrors({})
                    }}
                  >
                    已有账号？去登录
                  </button>
                  <button type="submit" className="auth-submit-button auth-submit-button--inline" disabled={submitting}>
                    {submitting ? '注册中...' : '注册并进入'}
                  </button>
                </div>
              )}
              {fieldErrors.form ? <p className="inline-message">{fieldErrors.form}</p> : null}
            </form>
          </section>
        </section>

        <div className="auth-bottom-line">
          <span className="auth-bottom-line__left"></span>
          <span className="auth-bottom-line__center"></span>
          <span className="auth-bottom-line__right"></span>
        </div>
      </div>
    </main>
  )
}
