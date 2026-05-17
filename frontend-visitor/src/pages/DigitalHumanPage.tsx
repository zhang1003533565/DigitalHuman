import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import '../App.css'
import {
  type Live2DModel,
  type MotionOption,
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
import { AppTopNav } from '../components/AppTopNav'

type DigitalHumanPageProps = {
  onLogout: () => void
}

type GuideChatResponse = {
  sessionId: string
  answerText: string
  relatedSpots: string[]
  recommendedRoutes: string[]
}

const GUIDE_SESSION_KEY = 'digitalhuman.visitor.guideSessionId'

type MotionTabId = 'combo' | 'expression' | 'micro'

type FaceControlState = {
  eyeOpen: number
  eyeSmile: number
  eyeballX: number
  eyeballY: number
  mouthOpen: number
  mouthForm: number
  blush: number
  angleX: number
  angleY: number
  angleZ: number
}

const DEFAULT_FACE_CONTROLS: FaceControlState = {
  eyeOpen: 1,
  eyeSmile: 0,
  eyeballX: 0,
  eyeballY: 0,
  mouthOpen: 0,
  mouthForm: 0,
  blush: 0,
  angleX: 0,
  angleY: 0,
  angleZ: 0,
}

const FACE_CONTROL_CONFIG: Array<{
  key: keyof FaceControlState
  label: string
  min: number
  max: number
  step: number
}> = [
  { key: 'eyeOpen', label: '睁眼程度', min: 0, max: 1, step: 0.01 },
  { key: 'eyeSmile', label: '笑眼程度', min: 0, max: 1, step: 0.01 },
  { key: 'eyeballX', label: '眼球左右', min: -1, max: 1, step: 0.01 },
  { key: 'eyeballY', label: '眼球上下', min: -1, max: 1, step: 0.01 },
  { key: 'mouthOpen', label: '嘴巴开合', min: 0, max: 1, step: 0.01 },
  { key: 'mouthForm', label: '嘴型变化', min: -1, max: 1, step: 0.01 },
  { key: 'blush', label: '脸红程度', min: 0, max: 1, step: 0.01 },
  { key: 'angleX', label: '头部左右', min: -30, max: 30, step: 1 },
  { key: 'angleY', label: '头部上下', min: -30, max: 30, step: 1 },
  { key: 'angleZ', label: '头部倾斜', min: -30, max: 30, step: 1 },
]

function applyFaceControls(model: Live2DModel, controls: FaceControlState) {
  const coreModel = model.internalModel?.coreModel

  coreModel?.setParameterValueById?.('ParamEyeLOpen', controls.eyeOpen)
  coreModel?.setParameterValueById?.('ParamEyeROpen', controls.eyeOpen)
  coreModel?.setParameterValueById?.('ParamEyeLSmile', controls.eyeSmile)
  coreModel?.setParameterValueById?.('ParamEyeRSmile', controls.eyeSmile)
  coreModel?.setParameterValueById?.('ParamEyeBallX', controls.eyeballX)
  coreModel?.setParameterValueById?.('ParamEyeBallY', controls.eyeballY)
  coreModel?.setParameterValueById?.('ParamMouthOpenY', controls.mouthOpen)
  coreModel?.setParameterValueById?.('ParamMouthForm', controls.mouthForm)
  coreModel?.setParameterValueById?.('ParamTere', controls.blush)
  coreModel?.setParameterValueById?.('ParamAngleX', controls.angleX)
  coreModel?.setParameterValueById?.('ParamAngleY', controls.angleY)
  coreModel?.setParameterValueById?.('ParamAngleZ', controls.angleZ)
}

function formatFaceControlValue(key: keyof FaceControlState, value: number) {
  if (key.startsWith('angle')) {
    return `${value > 0 ? '+' : ''}${Math.round(value)}`
  }

  if (key === 'eyeballX' || key === 'eyeballY' || key === 'mouthForm') {
    return value.toFixed(2)
  }

  return `${Math.round(value * 100)}%`
}

export function DigitalHumanPage({ onLogout }: DigitalHumanPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const loadIdRef = useRef(0)
  const isMountedRef = useRef(false)
  const [selectedModelId, setSelectedModelId] = useState('haru_greeter_pro_jp')
  const [selectedVoiceId, setSelectedVoiceId] = useState(VOICE_OPTIONS[0].id)
  const [text, setText] = useState(DEFAULT_TEXT)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const [pitch, setPitch] = useState(DEFAULT_PITCH)
  const [status, setStatus] = useState('正在加载 Live2D 模型...')
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionId, setSessionId] = useState(() => window.sessionStorage.getItem(GUIDE_SESSION_KEY) ?? '')
  const [answerText, setAnswerText] = useState('')
  const [relatedSpots, setRelatedSpots] = useState<string[]>([])
  const [recommendedRoutes, setRecommendedRoutes] = useState<string[]>([])
  const [feedbackStatus, setFeedbackStatus] = useState('')
  const [activeMotionKey, setActiveMotionKey] = useState<string | null>(null)
  const [activeMotionTab, setActiveMotionTab] = useState<MotionTabId>('combo')
  const [faceControls, setFaceControls] = useState<FaceControlState>(DEFAULT_FACE_CONTROLS)

  const selectedModel =
    MODEL_OPTIONS.find((model) => model.id === selectedModelId) ??
    MODEL_OPTIONS[0]

  const motionOptions = selectedModel.motionOptions ?? []
  const microMotionOptions = selectedModel.microMotionOptions ?? []

  const motionTabs = [
    { id: 'combo' as const, label: '组合动作' },
    { id: 'expression' as const, label: '表情' },
    { id: 'micro' as const, label: '细微动作' },
  ]

  const selectedVoice =
    VOICE_OPTIONS.find((voice) => voice.id === selectedVoiceId) ??
    VOICE_OPTIONS[0]

  const visibleMotionOptions =
    activeMotionTab === 'combo'
      ? motionOptions
      : activeMotionTab === 'micro'
        ? microMotionOptions
        : []

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
    const model = modelRef.current

    if (!model || selectedModel.id !== 'haru_greeter_pro_jp') {
      return
    }

    let frameId = 0

    const apply = () => {
      const currentModel = modelRef.current

      if (currentModel && selectedModel.id === 'haru_greeter_pro_jp') {
        applyFaceControls(currentModel, faceControls)
      }

      frameId = window.requestAnimationFrame(apply)
    }

    apply()

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [faceControls, selectedModel.id, isReady])

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

  function getMotionKey(motion: MotionOption) {
    return `${motion.group}:${motion.index ?? 'random'}`
  }

  function handlePlayMotion(motion: MotionOption) {
    const model = modelRef.current

    if (!model) {
      setStatus('模型还没有加载完成。')
      return
    }

    model.motion(motion.group, motion.index)
    setActiveMotionKey(getMotionKey(motion))
    setStatus(`正在播放 ${selectedModel.name} 动作：${motion.label}`)
  }

  function handleFaceControlChange(key: keyof FaceControlState, value: number) {
    setFaceControls((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleResetFaceControls() {
    setFaceControls(DEFAULT_FACE_CONTROLS)
    setStatus('已重置表情和头部参数。')
  }

  async function handleStartSpeaking() {
    const model = modelRef.current
    const content = text.trim()

    if (!model || !content) {
      setStatus(content ? '模型还没有加载完成。' : '请输入要说的内容。')
      return
    }

    setIsSpeaking(true)
    setStatus('正在请求后端导览问答...')

    try {
      const chatResponse = await axios.post<GuideChatResponse>('/api/guide/chat', {
        sessionId: sessionId || undefined,
        question: content,
      })

      const nextSessionId = chatResponse.data.sessionId
      setSessionId(nextSessionId)
      window.sessionStorage.setItem(GUIDE_SESSION_KEY, nextSessionId)
      setAnswerText(chatResponse.data.answerText)
      setRelatedSpots(chatResponse.data.relatedSpots)
      setRecommendedRoutes(chatResponse.data.recommendedRoutes)

      const startTime = performance.now()
      const response = await axios.post(
        TTS_ENDPOINT,
        {
          text: chatResponse.data.answerText,
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
      setStatus(`导览回答已生成，正在驱动口型。耗时: ${durationMs}ms`)
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

  async function submitFeedback(helpful: boolean) {
    if (!sessionId || !text.trim()) {
      setFeedbackStatus('请先完成一次导览提问。')
      return
    }

    try {
      await axios.post('/api/guide/feedback', {
        sessionId,
        question: text.trim(),
        answer: answerText,
        helpful,
        rating: helpful ? 5 : 2,
        comment: helpful ? '导览回答有帮助' : '需要补充更准确的景点信息',
      })
      setFeedbackStatus(helpful ? '已提交正向反馈。' : '已提交待优化反馈。')
    } catch (error) {
      console.error(error)
      setFeedbackStatus('反馈提交失败，请稍后重试。')
    }
  }

  return (
    <main className="module-screen">
      <AppTopNav onLogout={onLogout} />

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
              2. 发起导览提问
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
              {isSpeaking ? '生成中...' : '开始导览'}
            </button>
          </div>

          {answerText ? (
            <div className="control-group answer-panel">
              <span className="label">导览回答</span>
              <p className="answer-text">{answerText}</p>
              <div className="tag-group">
                {relatedSpots.map((spot) => (
                  <span key={spot} className="info-tag">{spot}</span>
                ))}
                {recommendedRoutes.map((route) => (
                  <span key={route} className="info-tag info-tag--warm">{route}</span>
                ))}
              </div>
              <div className="feedback-actions">
                <button type="button" onClick={() => void submitFeedback(true)}>有帮助</button>
                <button type="button" className="ghost-button" onClick={() => void submitFeedback(false)}>
                  待优化
                </button>
              </div>
              {feedbackStatus ? <p className="status">{feedbackStatus}</p> : null}
            </div>
          ) : null}

          <p className="status">{status}</p>
        </section>

        <aside
          className="motion-drawer motion-drawer--open"
          aria-label="动作抽屉"
        >
          <div id="motion-drawer-panel" className="motion-drawer__panel">
            <p className="motion-drawer__eyebrow">Motion Preview</p>
            <h2>{selectedModel.name} 动作列表</h2>
            <p className="motion-drawer__description">
              通过页签切换不同动作层级，直接预览当前模型能播放的动画效果。
            </p>

            <div className="motion-tabs" role="tablist" aria-label="动作分类">
              {motionTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeMotionTab === tab.id}
                  className={`motion-tab ${activeMotionTab === tab.id ? 'motion-tab--active' : ''}`}
                  onClick={() => setActiveMotionTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeMotionTab === 'expression' ? (
              <div className="expression-panel">
                <p className="motion-drawer__description">
                  直接调 Haru 的眼睛、嘴、脸红和头部朝向参数，适合做表情调试。
                </p>

                <div className="expression-panel__grid">
                  {FACE_CONTROL_CONFIG.map((control) => (
                    <div key={control.key} className="slider-group">
                      <label className="slider-label" htmlFor={`face-${control.key}`}>
                        <span>{control.label}</span>
                        <span>{formatFaceControlValue(control.key, faceControls[control.key])}</span>
                      </label>
                      <input
                        id={`face-${control.key}`}
                        type="range"
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        value={faceControls[control.key]}
                        disabled={!isReady || selectedModel.id !== 'haru_greeter_pro_jp'}
                        onChange={(event) =>
                          handleFaceControlChange(control.key, Number(event.target.value))
                        }
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="expression-panel__reset"
                  disabled={!isReady || selectedModel.id !== 'haru_greeter_pro_jp'}
                  onClick={handleResetFaceControls}
                >
                  重置表情参数
                </button>

                {selectedModel.id !== 'haru_greeter_pro_jp' ? (
                  <p className="motion-drawer__empty">
                    当前表情面板先只对 Haru 模型开放。
                  </p>
                ) : null}
              </div>
            ) : visibleMotionOptions.length > 0 ? (
              <div className="motion-drawer__grid">
                {visibleMotionOptions.map((motion) => {
                  const motionKey = getMotionKey(motion)
                  const isActive = activeMotionKey === motionKey

                  return (
                    <button
                      key={motionKey}
                      type="button"
                      className={`motion-chip ${isActive ? 'motion-chip--active' : ''}`}
                      disabled={!isReady}
                      onClick={() => handlePlayMotion(motion)}
                    >
                      {motion.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="motion-drawer__empty">
                当前模型还没有配置可直接预览的动作清单。
              </p>
            )}

            {activeMotionTab !== 'expression' && motionOptions.length > 0 && visibleMotionOptions.length === 0 ? (
              <p className="motion-drawer__empty">
                这个分类下暂时没有可播放动作。
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  )
}
