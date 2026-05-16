import { type FormEvent, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import './App.css'

type Live2DModel = {
  width: number
  height: number
  x: number
  y: number
  dragging?: boolean
  _pointerX?: number
  _pointerY?: number
  buttonMode: boolean
  position: {
    x: number
    y: number
  }
  scale: {
    set: (value: number) => void
  }
  on: (eventName: string, handler: (...args: unknown[]) => void) => void
  speak: (
    audio: string,
    options?: {
      volume?: number
      expression?: number | string
      resetExpression?: boolean
      crossOrigin?: string
    },
  ) => void
  motion: (name: string) => void
  expression: () => void
  destroy?: () => void
}

type PixiApplication = {
  stage: {
    addChild: (model: Live2DModel) => void
    removeChild: (model: Live2DModel) => void
  }
  start: () => void
  stop: () => void
  destroy: (removeView?: boolean, options?: { children?: boolean }) => void
}

type PixiGlobal = {
  Application: new (options: {
    view: HTMLCanvasElement
    autoStart: boolean
    resizeTo: Window
    backgroundAlpha?: number
    backgroundColor?: number
  }) => PixiApplication
  live2d: {
    Live2DModel: {
      from: (modelUrl: string) => Promise<Live2DModel>
    }
  }
}

type DragPointerEvent = {
  data: {
    global: {
      x: number
      y: number
    }
  }
}

type ModelOption = {
  id: string
  name: string
  url: string
  scaleMultiplier?: number
  xOffsetRatio?: number
  yOffsetRatio?: number
  bodyMotionGroup?: string
}

type SessionUser = {
  username: string
}

declare global {
  interface Window {
    PIXI?: PixiGlobal
  }
}

const LIVE2D_SCRIPTS = [
  '/live2d/js/live2dcubismcore.min.js',
  '/live2d/js/live2d.min.js',
  '/live2d/js/pixi.min.js',
  '/live2d/js/cubism4.min.js',
]

const MODEL_OPTIONS = [
  {
    id: 'hiyori_pro_zh',
    name: 'Hiyori 中文模型',
    url: '/live2d/hiyori_pro_zh/hiyori_pro_t11.model3.json',
    scaleMultiplier: 0.9,
    xOffsetRatio: 0,
    yOffsetRatio: 0.06,
    bodyMotionGroup: 'Tap@Body',
  },
  {
    id: 'kei_vowels_pro',
    name: 'Kei 中文口型模型',
    url: '/live2d/kei_vowels_pro/kei_vowels_pro.model3.json',
  },
  {
    id: 'haru_greeter_pro_jp',
    name: 'Haru Greeter',
    url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json',
  },
  {
    id: 'mark_free_zh',
    name: 'Mark 中文模型',
    url: '/live2d/mark_free_zh/mark_free_t04.model3.json',
    scaleMultiplier: 0.78,
    xOffsetRatio: 0,
    yOffsetRatio: 0.14,
  },
] satisfies ModelOption[]

const VOICE_OPTIONS = [
  { id: 'zh-CN-XiaoxiaoNeural', name: '晓晓 (女声)' },
  { id: 'zh-CN-XiaoyiNeural', name: '小艺 (女声)' },
  { id: 'zh-CN-YunjianNeural', name: '云渐 (男声)' },
  { id: 'zh-CN-YunxiNeural', name: '云希 (男声)' },
  { id: 'zh-CN-YunxiaNeural', name: '云夏 (女声)' },
  { id: 'zh-CN-YunyangNeural', name: '云扬 (男声)' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', name: '小北 (东北话)' },
  { id: 'zh-CN-shaanxi-XiaoniNeural', name: '小妮 (陕西话)' },
  { id: 'zh-HK-HiuGaaiNeural', name: 'Hiugaai (粤语女声)' },
  { id: 'zh-HK-HiuMaanNeural', name: 'Hiumaan (粤语女声)' },
  { id: 'zh-HK-WanLungNeural', name: 'Wanlung (粤语男声)' },
  { id: 'zh-TW-HsiaoChenNeural', name: '晓珍 (台湾女声)' },
  { id: 'zh-TW-HsiaoYuNeural', name: '晓瑜 (台湾女声)' },
  { id: 'zh-TW-YunJheNeural', name: '云哲 (台湾男声)' },
]

const SESSION_STORAGE_KEY = 'digitalhuman.visitor.user'
const DEMO_AUDIO_URL = '/live2d/01_kei_zh.wav'
const DEFAULT_TEXT = '你好，欢迎来到数字人导览模块。'
const TTS_ENDPOINT = '/edge-tts/tts'
const DEFAULT_RATE = 0
const DEFAULT_VOLUME = 0
const DEFAULT_PITCH = 0
const DEFAULT_AUTH_REDIRECT = '/home'
const DIGITAL_HUMAN_ROUTE = '/modules/digital-human'

let live2dScriptsPromise: Promise<void> | null = null

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    )

    if (existingScript) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`加载脚本失败：${src}`))
    document.body.appendChild(script)
  })
}

function loadLive2dScripts() {
  if (!live2dScriptsPromise) {
    live2dScriptsPromise = LIVE2D_SCRIPTS.reduce(
      (promise, src) => promise.then(() => loadScript(src)),
      Promise.resolve(),
    )
  }

  return live2dScriptsPromise
}

function makeDraggable(model: Live2DModel) {
  model.buttonMode = true

  model.on('pointerdown', (event) => {
    const pointerEvent = event as DragPointerEvent
    model.dragging = true
    model._pointerX = pointerEvent.data.global.x - model.x
    model._pointerY = pointerEvent.data.global.y - model.y
  })

  model.on('pointermove', (event) => {
    if (!model.dragging) {
      return
    }

    const pointerEvent = event as DragPointerEvent
    model.position.x = pointerEvent.data.global.x - (model._pointerX ?? 0)
    model.position.y = pointerEvent.data.global.y - (model._pointerY ?? 0)
  })

  model.on('pointerupoutside', () => {
    model.dragging = false
  })

  model.on('pointerup', () => {
    model.dragging = false
  })
}

function speak(model: Live2DModel, audioUrl: string) {
  model.speak(audioUrl, {
    volume: 1,
    crossOrigin: 'anonymous',
  })
}

function formatPercent(value: number) {
  return `${value >= 0 ? '+' : ''}${value}%`
}

function formatPitch(value: number) {
  return `${value >= 0 ? '+' : ''}${value}Hz`
}

function getStoredUser() {
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue) as SessionUser
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

function saveUser(username: string) {
  const nextUser = { username }
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser))
  return nextUser
}

function clearUser() {
  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

function ProtectedRoute({ user }: { user: SessionUser | null }) {
  const location = useLocation()

  if (!user) {
    const redirect = `${location.pathname}${location.search}`
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }

  return <Outlet />
}

function LoginScreen({
  user,
  onLogin,
}: {
  user: SessionUser | null
  onLogin: (username: string) => void
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('visitor')
  const [password, setPassword] = useState('123456')
  const [error, setError] = useState('')
  const redirectTarget = searchParams.get('redirect') || DEFAULT_AUTH_REDIRECT

  useEffect(() => {
    if (user) {
      navigate(redirectTarget, { replace: true })
    }
  }, [navigate, redirectTarget, user])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!username.trim()) {
      setError('请输入用户名。')
      return
    }

    if (password !== '123456') {
      setError('演示密码固定为 123456。')
      return
    }

    setError('')
    onLogin(username.trim())
    navigate(redirectTarget, { replace: true })
  }

  return (
    <main className="auth-screen">
      <section className="auth-copy">
        <p className="surface-tag">DigitalHuman Visitor</p>
        <h1>数字人迎宾入口</h1>
        <p className="surface-copy">
          现在使用独立路由组织页面，数字人模块可以被首页或后续其他入口直接跳转进入。
        </p>
        <div className="auth-tips">
          <div>
            <span>演示账号</span>
            <strong>visitor / 123456</strong>
          </div>
          <div>
            <span>备用账号</span>
            <strong>operator / 123456</strong>
          </div>
        </div>
      </section>

      <section className="auth-card">
        <form className="auth-form" onSubmit={handleSubmit}>
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

          <button type="submit">进入首页</button>
          {error ? <p className="inline-message">{error}</p> : null}
        </form>
      </section>
    </main>
  )
}

function HomeScreen({
  user,
  onLogout,
}: {
  user: SessionUser
  onLogout: () => void
}) {
  const navigate = useNavigate()

  return (
    <main className="home-screen">
      <header className="hero-panel">
        <div>
          <p className="surface-tag">Welcome Back</p>
          <h1>{user.username}，欢迎进入数字人首页</h1>
          <p className="surface-copy">
            首页现在只是其中一个入口页。后续景点页、活动页、导览页都可以直接跳到数字人模块。
          </p>
        </div>
        <button className="ghost-button" type="button" onClick={onLogout}>
          退出登录
        </button>
      </header>

      <section className="home-grid">
        <article className="feature-card feature-card--primary">
          <p className="card-kicker">核心入口</p>
          <h2>数字人模块</h2>
          <p>
            作为独立功能页存在，负责模型切换、音色切换、本地测试和 TTS 驱动口型。
          </p>
          <button type="button" onClick={() => navigate(DIGITAL_HUMAN_ROUTE)}>
            进入数字人模块
          </button>
        </article>

        <article className="feature-card">
          <p className="card-kicker">后续扩展</p>
          <h2>多入口接入</h2>
          <p>后续你可以在景点详情、活动报名、导览咨询等页面直接跳转到这个独立路由。</p>
          <button type="button" onClick={() => navigate(DIGITAL_HUMAN_ROUTE)}>
            从这里也能进入
          </button>
        </article>

        <article className="feature-card">
          <p className="card-kicker">当前能力</p>
          <h2>路由结构</h2>
          <ul className="feature-list">
            <li>`/login` 登录页</li>
            <li>`/home` 首页</li>
            <li>`/modules/digital-human` 数字人模块页</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

function DigitalHumanModule({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const loadIdRef = useRef(0)
  const isMountedRef = useRef(false)
  const [selectedModelId, setSelectedModelId] = useState(MODEL_OPTIONS[0].id)
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_OPTIONS[0].id)
  const [text, setText] = useState(DEFAULT_TEXT)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [pitch, setPitch] = useState(DEFAULT_PITCH)
  const [status, setStatus] = useState('正在加载 Live2D 模型...')
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const selectedModel =
    MODEL_OPTIONS.find((model) => model.id === selectedModelId) ??
    MODEL_OPTIONS[0]

  const selectedVoice =
    VOICE_OPTIONS.find((voice) => voice.id === selectedVoiceId) ??
    VOICE_OPTIONS[0]

  useEffect(() => {
    isMountedRef.current = true

    async function initPixiApp() {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      try {
        await loadLive2dScripts()

        if (!isMountedRef.current || !window.PIXI || appRef.current) {
          return
        }

        const pixiApp = new window.PIXI.Application({
          view: canvas,
          autoStart: true,
          resizeTo: window,
          backgroundAlpha: 0,
          backgroundColor: 0x101820,
        })
        appRef.current = pixiApp
      } catch (error) {
        console.error(error)
        setStatus('Live2D 运行库加载失败，请检查 public/live2d/js 资源是否完整。')
      }
    }

    void initPixiApp()

    return () => {
      isMountedRef.current = false
      loadIdRef.current += 1
      modelRef.current = null
      appRef.current?.destroy(true, { children: true })
      appRef.current = null
    }
  }, [])

  useEffect(() => {
    const loadId = loadIdRef.current + 1
    loadIdRef.current = loadId

    async function loadSelectedModel() {
      try {
        setIsReady(false)
        setStatus(`正在加载 ${selectedModel.name}...`)

        await loadLive2dScripts()

        if (!isMountedRef.current || loadId !== loadIdRef.current || !window.PIXI) {
          return
        }

        const canvas = canvasRef.current
        let app = appRef.current

        if (!app) {
          if (!canvas) {
            return
          }

          app = new window.PIXI.Application({
            view: canvas,
            autoStart: true,
            resizeTo: window,
            backgroundAlpha: 0,
            backgroundColor: 0x101820,
          })
          appRef.current = app
        }

        app.stop()

        const model = await window.PIXI.live2d.Live2DModel.from(selectedModel.url)

        if (!isMountedRef.current || loadId !== loadIdRef.current) {
          return
        }

        const currentModel = modelRef.current
        if (currentModel) {
          app.stage.removeChild(currentModel)
          modelRef.current = null
        }

        app.stage.addChild(model)

        const scaleX = window.innerWidth / model.width
        const scaleY = window.innerHeight / model.height
        const scaleMultiplier = selectedModel.scaleMultiplier ?? 0.84
        const xOffsetRatio = selectedModel.xOffsetRatio ?? 0
        const yOffsetRatio = selectedModel.yOffsetRatio ?? 0.08

        model.scale.set(Math.min(scaleX, scaleY) * scaleMultiplier)
        model.x = (window.innerWidth - model.width) / 2 + window.innerWidth * xOffsetRatio
        model.y = window.innerHeight * yOffsetRatio

        makeDraggable(model)

        model.on('hit', (...args: unknown[]) => {
          const hitAreas = Array.isArray(args[0]) ? (args[0] as string[]) : []

          if (hitAreas.includes('Body') && selectedModel.bodyMotionGroup) {
            model.motion(selectedModel.bodyMotionGroup)
          }

          if (hitAreas.includes('Head')) {
            model.expression()
          }
        })

        modelRef.current = model
        app.start()
        setIsReady(true)
        setStatus(`${selectedModel.name} 已加载，可以测试说话。`)
      } catch (error) {
        console.error(error)
        appRef.current?.start()
        setStatus(`${selectedModel.name} 加载失败，请检查 public/live2d 资源是否完整。`)
      }
    }

    void loadSelectedModel()

    return () => {
      if (loadId === loadIdRef.current) {
        appRef.current?.start()
      }
    }
  }, [
    selectedModel.name,
    selectedModel.url,
    selectedModel.bodyMotionGroup,
    selectedModel.scaleMultiplier,
    selectedModel.xOffsetRatio,
    selectedModel.yOffsetRatio,
  ])

  function handlePlayDemo() {
    const model = modelRef.current
    if (!model) {
      return
    }

    speak(model, `${DEMO_AUDIO_URL}?v=${Date.now()}`)
  }

  async function handleStartSpeaking() {
    const model = modelRef.current
    const content = text.trim()

    if (!model || !content) {
      setStatus(content ? '模型还没有加载完成。' : '请输入要说的内容。')
      return
    }

    setIsSpeaking(true)
    setStatus('正在请求后端生成音频...')

    try {
      const startTime = performance.now()
      const response = await axios.post(
        TTS_ENDPOINT,
        {
          text: content,
          voice: selectedVoice.id,
          rate: formatPercent(rate),
          volume: formatPercent(volume),
          pitch: formatPitch(pitch),
        },
        {
          responseType: 'blob',
        },
      )

      const audioUrl = URL.createObjectURL(response.data)
      const durationMs = Math.round(performance.now() - startTime)

      speak(model, audioUrl)
      setStatus(`音频已生成，正在驱动口型。耗时: ${durationMs}ms`)
    } catch (error) {
      console.error(error)
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try {
          const detailText = await error.response.data.text()
          const detailJson = JSON.parse(detailText) as { detail?: string }
          setStatus(`请求 TTS 接口失败: ${detailJson.detail || error.message}`)
        } catch {
          setStatus(`请求 TTS 接口失败: ${error.message}`)
        }
      } else {
        setStatus(
          `请求 TTS 接口失败: ${error instanceof Error ? error.message : '请确认 Python TTS 服务已启动。'}`,
        )
      }
    } finally {
      setIsSpeaking(false)
    }
  }

  return (
    <main className="module-screen">
      <div className="module-topbar">
        <button className="ghost-button" type="button" onClick={() => navigate('/home')}>
          返回首页
        </button>
        <button className="ghost-button" type="button" onClick={onLogout}>
          退出登录
        </button>
      </div>

      <section className="live2d-page">
        <canvas ref={canvasRef} className="live2d-canvas" />

        <section className="control-panel" aria-label="数字人控制面板">
          <p className="eyebrow">Digital Human Module</p>
          <h1>数字人口型驱动</h1>
          <p className="description">
            当前模块是独立路由页面，后面可以被首页、景点页、活动页或任何其他入口直接跳转进入。
          </p>

          <div className="control-group">
            <label className="label" htmlFor="model-select">
              选择模型
            </label>
            <select
              id="model-select"
              value={selectedModelId}
              disabled={isSpeaking}
              onChange={(event) => setSelectedModelId(event.target.value)}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label className="label" htmlFor="voice-select">
              选择声音
            </label>
            <select
              id="voice-select"
              value={selectedVoiceId}
              disabled={isSpeaking}
              onChange={(event) => setSelectedVoiceId(event.target.value)}
            >
              {VOICE_OPTIONS.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <span className="label">1. 本地音频测试</span>
            <button type="button" disabled={!isReady} onClick={handlePlayDemo}>
              测试音频
            </button>
          </div>

          <div className="control-group">
            <label className="label" htmlFor="speech-text">
              2. 调用接口生成音频
            </label>
            <textarea
              id="speech-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            <div className="tts-tuning">
              <div className="slider-group">
                <label className="slider-label" htmlFor="rate-range">
                  <span>语速</span>
                  <span>{formatPercent(rate)}</span>
                </label>
                <input
                  id="rate-range"
                  type="range"
                  min={-50}
                  max={100}
                  step={5}
                  value={rate}
                  disabled={isSpeaking}
                  onChange={(event) => setRate(Number(event.target.value))}
                />
              </div>

              <div className="slider-group">
                <label className="slider-label" htmlFor="volume-range">
                  <span>音量</span>
                  <span>{formatPercent(volume)}</span>
                </label>
                <input
                  id="volume-range"
                  type="range"
                  min={-50}
                  max={50}
                  step={5}
                  value={volume}
                  disabled={isSpeaking}
                  onChange={(event) => setVolume(Number(event.target.value))}
                />
              </div>

              <div className="slider-group">
                <label className="slider-label" htmlFor="pitch-range">
                  <span>音高</span>
                  <span>{formatPitch(pitch)}</span>
                </label>
                <input
                  id="pitch-range"
                  type="range"
                  min={-50}
                  max={50}
                  step={5}
                  value={pitch}
                  disabled={isSpeaking}
                  onChange={(event) => setPitch(Number(event.target.value))}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={!isReady || isSpeaking}
              onClick={handleStartSpeaking}
            >
              {isSpeaking ? '生成中...' : '开始说话'}
            </button>
          </div>

          <p className="status">{status}</p>
        </section>
      </section>
    </main>
  )
}

function App() {
  const [user, setUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    setUser(getStoredUser())
  }, [])

  function handleLogin(username: string) {
    setUser(saveUser(username))
  }

  function handleLogout() {
    clearUser()
    setUser(null)
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={user ? DEFAULT_AUTH_REDIRECT : '/login'} replace />}
      />
      <Route
        path="/login"
        element={<LoginScreen user={user} onLogin={handleLogin} />}
      />
      <Route element={<ProtectedRoute user={user} />}>
        <Route
          path="/home"
          element={<HomeScreen user={user as SessionUser} onLogout={handleLogout} />}
        />
        <Route
          path={DIGITAL_HUMAN_ROUTE}
          element={<DigitalHumanModule onLogout={handleLogout} />}
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
