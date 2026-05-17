import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '../App.css'
import loginBgImage from '../assets/login/ChatGPT Image 2026年5月16日 22_01_11.png'
import loginTitleImage from '../assets/login/Tittle.png'
import loginSubtitleImage from '../assets/login/fuTittle.png'
import {
  type Live2DModel,
  type PixiApplication,
  MODEL_OPTIONS,
  loadLive2dScripts,
  makeDraggable,
} from '../digitalHuman/shared'
import { DEFAULT_AUTH_REDIRECT, type SessionUser } from '../auth/session'

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

function CloudLineIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.5 18a4.5 4.5 0 1 1 .9-8.9A5.5 5.5 0 0 1 18 11a3.5 3.5 0 1 1 0 7Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  )
}

function LoginDigitalHumanEmbed() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const homePositionRef = useRef({ x: 0, y: 0 })
  const returnTimerRef = useRef<number | null>(null)
  const returnFrameRef = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true

    function clearReturnAnimation() {
      if (returnTimerRef.current !== null) {
        window.clearTimeout(returnTimerRef.current)
        returnTimerRef.current = null
      }

      if (returnFrameRef.current !== null) {
        window.cancelAnimationFrame(returnFrameRef.current)
        returnFrameRef.current = null
      }
    }

    function animateBackToHome() {
      const model = modelRef.current

      if (!model) {
        return
      }

      const step = () => {
        const currentModel = modelRef.current

        if (!currentModel || currentModel.dragging) {
          returnFrameRef.current = null
          return
        }

        const dx = homePositionRef.current.x - currentModel.x
        const dy = homePositionRef.current.y - currentModel.y

        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
          currentModel.position.x = homePositionRef.current.x
          currentModel.position.y = homePositionRef.current.y
          returnFrameRef.current = null
          return
        }

        currentModel.position.x += dx * 0.12
        currentModel.position.y += dy * 0.12
        returnFrameRef.current = window.requestAnimationFrame(step)
      }

      returnFrameRef.current = window.requestAnimationFrame(step)
    }

    function scheduleReturnToHome() {
      clearReturnAnimation()
      returnTimerRef.current = window.setTimeout(() => {
        animateBackToHome()
      }, 1800)
    }

    function resizeCanvas() {
      const canvas = canvasRef.current
      const model = modelRef.current

      if (!canvas) {
        return
      }

      const width = window.innerWidth
      const height = window.innerHeight

      canvas.width = width
      canvas.height = height

      if (!model) {
        return
      }

      homePositionRef.current = {
        x: width * 0.42 - model.width * 0.14,
        y: Math.max(height * 0.58 - model.height * 0.5, 160),
      }

      if (!model.dragging) {
        model.position.x = homePositionRef.current.x
        model.position.y = homePositionRef.current.y
      }
    }

    async function initModel() {
      const canvas = canvasRef.current
      const selectedModel = MODEL_OPTIONS.find((model) => model.id === 'mark_free_zh')

      if (!canvas || !selectedModel) {
        return
      }

      try {
        await loadLive2dScripts()

        if (!mounted || !window.PIXI) {
          return
        }

        const width = window.innerWidth
        const height = window.innerHeight

        const pixiApp = new window.PIXI.Application({
          view: canvas,
          autoStart: true,
          resizeTo: window,
          width,
          height,
          backgroundAlpha: 0,
          backgroundColor: 0x000000,
        })

        appRef.current = pixiApp

        const model = await window.PIXI.live2d.Live2DModel.from(selectedModel.url)

        if (!mounted) {
          return
        }

        pixiApp.stage.addChild(model)

        const scaleX = width / model.width
        const scaleY = height / model.height
        const scaleMultiplier = (selectedModel.scaleMultiplier ?? 0.84) * 0.74
        model.scale.set(Math.min(scaleX, scaleY) * (scaleMultiplier + 0.1))
        homePositionRef.current = {
          x: width * 0.42 - model.width * 0.14,
          y: Math.max(height * 0.58 - model.height * 0.5, 160),
        }
        model.x = homePositionRef.current.x
        model.y = homePositionRef.current.y
        makeDraggable(model, {
          onDragStart: () => {
            clearReturnAnimation()

            if (selectedModel.dragStartMotionGroup) {
              model.motion(selectedModel.dragStartMotionGroup)
            }
          },
          onDragMove: clearReturnAnimation,
          onDragEnd: () => {
            if (selectedModel.dragEndMotionGroup) {
              model.motion(selectedModel.dragEndMotionGroup)
            }

            scheduleReturnToHome()
          },
        })

        model.on('hit', (...args: unknown[]) => {
          const hitAreas = Array.isArray(args[0]) ? (args[0] as string[]) : []

          if (hitAreas.includes('Head')) {
            model.expression()
            return
          }

          if (hitAreas.includes('Body') && selectedModel.bodyMotionGroup) {
            model.motion(selectedModel.bodyMotionGroup)
          }
        })

        modelRef.current = model
        resizeCanvas()
        window.addEventListener('resize', resizeCanvas)
      } catch (error) {
        console.error(error)
      }
    }

    void initModel()

    return () => {
      mounted = false
      clearReturnAnimation()
      window.removeEventListener('resize', resizeCanvas)
      modelRef.current = null
      appRef.current?.destroy(true, { children: true })
      appRef.current = null
    }
  }, [])

  return (
    <section className="login-dh-embed" aria-label="登录页数字人交互区">
      <div className="login-dh-stage">
        <canvas ref={canvasRef} className="login-dh-canvas" />
      </div>
    </section>
  )
}

type LoginPageProps = {
  user: SessionUser | null
  onLogin: (username: string) => void
}

export function LoginPage({ user, onLogin }: LoginPageProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!username.trim()) {
      setError('请输入用户名。')
      return
    }

    if (!password.trim()) {
      setError('请输入密码。')
      return
    }

    setError('')
    onLogin(username.trim())
    navigate(redirectTarget, { replace: true })
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

  return (
    <main
      className="auth-screen auth-screen--tourism"
      style={{ backgroundImage: `linear-gradient(180deg, rgba(3, 13, 31, 0.18), rgba(2, 8, 22, 0.6)), url(${loginBgImage})` }}
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
            <LoginDigitalHumanEmbed />
          </section>

          <section className="auth-card auth-card--tourism">
            <span className="auth-card-corner auth-card-corner--lt"></span>
            <span className="auth-card-corner auth-card-corner--rt"></span>
            <span className="auth-card-corner auth-card-corner--lb"></span>
            <span className="auth-card-corner auth-card-corner--rb"></span>
            <div className="auth-card-top">
              <div className="auth-card-title-line">
                <span></span>
                <p className="panel-label">用户登录</p>
                <span></span>
              </div>
            </div>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="auth-input">
                <span className="sr-only">用户名</span>
                <span className="auth-input__icon"><UserLineIcon /></span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="请输入用户名"
                />
              </label>

              <label className="auth-input">
                <span className="sr-only">密码</span>
                <span className="auth-input__icon"><LockLineIcon /></span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                />
                <span className="auth-input__suffix"><EyeOffLineIcon /></span>
              </label>

              <div className="auth-actions">
                <label className="auth-checkbox">
                  <input type="checkbox" />
                  <span>记住我</span>
                </label>
                <button type="button" className="auth-link-button">
                  忘记密码?
                </button>
              </div>

              <button type="submit" className="auth-submit-button">
                登录
              </button>
              {error ? <p className="inline-message">{error}</p> : null}
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
