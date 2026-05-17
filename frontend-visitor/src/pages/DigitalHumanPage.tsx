import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import '../App.css'
import {
  type Live2DModel,
  type PixiApplication,
  DEFAULT_PITCH,
  DEFAULT_RATE,
  DEFAULT_TEXT,
  DEFAULT_VOLUME,
  DEMO_AUDIO_URL,
  MODEL_OPTIONS,
  TTS_ENDPOINT,
  VOICE_OPTIONS,
  formatPercent,
  formatPitch,
  loadLive2dScripts,
  makeDraggable,
  speak,
} from '../digitalHuman/shared'

type DigitalHumanPageProps = {
  onLogout: () => void
}

export function DigitalHumanPage({ onLogout }: DigitalHumanPageProps) {
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
