import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
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

type ModelOption = {
  id: string
  name: string
  url: string
  scaleMultiplier?: number
  xOffsetRatio?: number
  yOffsetRatio?: number
  bodyMotionGroup?: string
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

const DEMO_AUDIO_URL = '/live2d/01_kei_zh.wav'
const DEFAULT_TEXT = '你好，欢迎光临'
const TTS_ENDPOINT = '/edge-tts/tts'
const DEFAULT_RATE = 0
const DEFAULT_VOLUME = 0
const DEFAULT_PITCH = 0

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
    model.dragging = true
    model._pointerX = event.data.global.x - model.x
    model._pointerY = event.data.global.y - model.y
  })

  model.on('pointermove', (event) => {
    if (!model.dragging) {
      return
    }

    model.position.x = event.data.global.x - (model._pointerX ?? 0)
    model.position.y = event.data.global.y - (model._pointerY ?? 0)
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

function App() {
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

        const model = await window.PIXI.live2d.Live2DModel.from(
          selectedModel.url,
        )

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

        model.on('hit', (hitAreas: string[]) => {
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
  }, [selectedModel.name, selectedModel.url])

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
      const response = await axios.post(TTS_ENDPOINT, {
        text: content,
        voice: selectedVoice.id,
        rate: formatPercent(rate),
        volume: formatPercent(volume),
        pitch: formatPitch(pitch),
      }, {
        responseType: 'blob',
      })

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
        setStatus(`请求 TTS 接口失败: ${error instanceof Error ? error.message : '请确认 Python TTS 服务已启动。'}`)
      }
    } finally {
      setIsSpeaking(false)
    }
  }

  return (
    <main className="live2d-page">
      <canvas ref={canvasRef} className="live2d-canvas" />

      <section className="control-panel" aria-label="数字人控制面板">
        <p className="eyebrow">Live2D Voice Demo</p>
        <h1>数字人口型驱动</h1>
        <p className="description">
          当前迁移自 live2dSpeek：文本交给后端生成音频，前端用音频驱动模型口型。
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
    </main>
  )
}

export default App
