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
  on: (eventName: string, handler: (...args: any[]) => void) => void
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
  }
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

const MODEL_URL = '/live2d/kei_vowels_pro/kei_vowels_pro.model3.json'
const DEMO_AUDIO_URL = '/live2d/01_kei_zh.wav'
const DEFAULT_TEXT = '你好，欢迎光临'
const TTS_ENDPOINT = 'http://127.0.0.1:2020/dealAudio'

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
    expression: 8,
    resetExpression: true,
    crossOrigin: 'anonymous',
  })
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const [text, setText] = useState(DEFAULT_TEXT)
  const [status, setStatus] = useState('正在加载 Live2D 模型...')
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function initLive2d() {
      const canvas = canvasRef.current
      if (!canvas) {
        return
      }

      try {
        await loadLive2dScripts()

        if (!isMounted || !window.PIXI) {
          return
        }

        const pixiApp = new window.PIXI.Application({
          view: canvas,
          autoStart: true,
          resizeTo: window,
          backgroundAlpha: 0,
          backgroundColor: 0x101820,
        })

        const model = await window.PIXI.live2d.Live2DModel.from(MODEL_URL)

        if (!isMounted) {
          model.destroy?.()
          pixiApp.destroy(true, { children: true })
          return
        }

        pixiApp.stage.addChild(model)

        const scaleX = window.innerWidth / model.width
        const scaleY = window.innerHeight / model.height
        model.scale.set(Math.min(scaleX, scaleY) * 0.84)
        model.x = (window.innerWidth - model.width) / 2
        model.y = window.innerHeight * 0.08

        makeDraggable(model)

        model.on('hit', (hitAreas: string[]) => {
          if (hitAreas.includes('Body')) {
            model.motion('Tap')
          }

          if (hitAreas.includes('Head')) {
            model.expression()
          }
        })

        appRef.current = pixiApp
        modelRef.current = model
        setIsReady(true)
        setStatus('模型已加载，可以测试说话。')
      } catch (error) {
        console.error(error)
        setStatus('Live2D 加载失败，请检查 public/live2d 资源是否完整。')
      }
    }

    void initLive2d()

    return () => {
      isMounted = false
      modelRef.current = null
      appRef.current?.destroy(true, { children: true })
      appRef.current = null
    }
  }, [])

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
      const response = await axios.get<string>(TTS_ENDPOINT, {
        params: {
          file_name: 'test.mp3',
          voice: 'xiaoxiao',
          text: content,
        },
      })
      const audioUrl = `${response.data}?v=${Date.now()}`

      speak(model, audioUrl)
      setStatus('音频已生成，正在驱动口型。')
    } catch (error) {
      console.error(error)
      setStatus('请求 TTS 接口失败，请确认 127.0.0.1:2020 服务已启动。')
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
