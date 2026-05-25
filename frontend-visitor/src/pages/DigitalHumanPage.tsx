import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import '../App.css'
import {
  type Live2DModel,
  type PixiApplication,
  DEFAULT_PITCH,
  DEFAULT_RATE,
  DEFAULT_VOLUME,
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

type DigitalHumanConfig = {
  modelId: string
  voiceId: string
  rate: number
  volume: number
  pitch: number
  welcomeText: string
  guideStyle: string
  broadcastStrategy: string
}

type GuideChatResponse = {
  sessionId: string
  traceId?: string
  answerText: string
  relatedSpots: string[]
  recommendedRoutes: string[]
  sources?: Array<{
    source_file?: string
    title?: string
    section_path?: string[]
  }>
}

type DigitalChatMessage = {
  id: string
  sender: 'guide' | 'me'
  name: string
  content: ReactNode
  time: Date
  status?: 'sent' | 'read' | 'failed'
}

type DigitalChatDropdownKey = 'factory' | 'voice' | 'model'

const GUIDE_SESSION_KEY = 'digitalhuman.visitor.guideSessionId'

const DEFAULT_CONFIG: DigitalHumanConfig = {
  modelId: 'hiyori_pro_zh',
  voiceId: VOICE_OPTIONS[0].id,
  rate: DEFAULT_RATE,
  volume: DEFAULT_VOLUME,
  pitch: DEFAULT_PITCH,
  welcomeText: '您好，欢迎来到灵山胜境，我可以为您介绍景点、路线和活动安排。',
  guideStyle: 'friendly',
  broadcastStrategy: 'standard',
}

const FACTORY_OPTIONS = [
  { id: 'lingshan', name: '灵山官方' },
  { id: 'qwen', name: '通义千问' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'volcengine', name: '火山引擎' },
  { id: 'xunfei', name: '讯飞星火' },
]

const CHAT_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatChatTime(time: Date) {
  return CHAT_TIME_FORMATTER.format(time)
}

function buildAssistantContent(response: GuideChatResponse) {
  return (
    <div className="digital-human-answer">
      <p>{response.answerText}</p>
      {response.answerText.includes('知识库暂未覆盖') ? (
        <p className="digital-human-answer__hint">
          这个问题目前还没有进入景区知识库，后台可以在知识缺失池中补充资料。
        </p>
      ) : null}
      {response.relatedSpots.length || response.recommendedRoutes.length ? (
        <div className="digital-human-answer__tags">
          {response.relatedSpots.map((spot) => (
            <span key={spot}>{spot}</span>
          ))}
          {response.recommendedRoutes.map((route) => (
            <span key={route}>{route}</span>
          ))}
        </div>
      ) : null}
      {response.sources?.length ? (
        <div className="digital-human-answer__sources">
          {response.sources.slice(0, 3).map((source, index) => (
            <span key={`${source.source_file ?? source.title ?? 'source'}-${index}`}>
              来源：{source.source_file || source.title || '知识库'}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function DigitalHumanPage({ onLogout }: DigitalHumanPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const chatActionsRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const loadIdRef = useRef(0)
  const isMountedRef = useRef(false)
  const [config, setConfig] = useState<DigitalHumanConfig>(DEFAULT_CONFIG)
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_CONFIG.modelId)
  const [status, setStatus] = useState('正在加载 Live2D 模型...')
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionId, setSessionId] = useState(() => window.sessionStorage.getItem(GUIDE_SESSION_KEY) ?? '')
  const [draft, setDraft] = useState('')
  const [selectedFactoryId, setSelectedFactoryId] = useState(FACTORY_OPTIONS[0].id)
  const [openDropdown, setOpenDropdown] = useState<DigitalChatDropdownKey | null>(null)
  const [messages, setMessages] = useState<DigitalChatMessage[]>([
    {
      id: 'welcome',
      sender: 'guide',
      name: '灵山导览数字人',
      content: DEFAULT_CONFIG.welcomeText,
      time: new Date(),
      status: 'read',
    },
  ])

  const selectedModel =
    MODEL_OPTIONS.find((model) => model.id === selectedModelId) ??
    MODEL_OPTIONS[0]

  const selectedVoice =
    VOICE_OPTIONS.find((voice) => voice.id === config.voiceId) ??
    VOICE_OPTIONS[0]

  const selectedFactory =
    FACTORY_OPTIONS.find((factory) => factory.id === selectedFactoryId) ??
    FACTORY_OPTIONS[0]

  const canSend = isReady && !isSpeaking && draft.trim().length > 0

  useEffect(() => {
    async function loadConfig() {
      try {
        const response = await axios.get<DigitalHumanConfig>('/api/user/digital-human/config')
        const nextConfig = { ...DEFAULT_CONFIG, ...response.data }
        setConfig(nextConfig)
        setSelectedModelId(nextConfig.modelId)
        setMessages((current) => {
          if (current.length !== 1 || current[0]?.id !== 'welcome') {
            return current
          }
          return [{
            ...current[0],
            content: nextConfig.welcomeText,
          }]
        })
      } catch (error) {
        console.error(error)
        setStatus('数字人配置读取失败，已使用默认展示配置。')
      }
    }

    void loadConfig()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, isSpeaking])

  useEffect(() => {
    if (!openDropdown) return

    function handleDocumentPointerDown(event: PointerEvent) {
      if (!chatActionsRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener('pointerdown', handleDocumentPointerDown)
    return () => document.removeEventListener('pointerdown', handleDocumentPointerDown)
  }, [openDropdown])

  useEffect(() => {
    document.documentElement.classList.add('digital-human-page-lock')
    document.body.classList.add('digital-human-page-lock')

    return () => {
      document.documentElement.classList.remove('digital-human-page-lock')
      document.body.classList.remove('digital-human-page-lock')
    }
  }, [])

  useEffect(() => {
    isMountedRef.current = true

    async function initPixiApp() {
      const canvas = canvasRef.current
      if (!canvas) return

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
          if (!canvas) return

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
        const yOffsetRatio = selectedModel.yOffsetRatio ?? 0.08
        const stageCenterX = window.innerWidth >= 980 ? window.innerWidth * 0.22 : window.innerWidth * 0.5

        model.scale.set(Math.min(scaleX, scaleY) * scaleMultiplier)
        model.x = stageCenterX - model.width / 2
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
        setStatus(`${selectedModel.name} 已就绪，可以开始导览问答。`)
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

  async function speakAnswer(answerText: string) {
    const model = modelRef.current
    if (!model || !answerText.trim()) return

    const response = await axios.post(
      TTS_ENDPOINT,
      {
        text: answerText,
        voice: selectedVoice.id,
        rate: formatPercent(config.rate),
        volume: formatPercent(config.volume),
        pitch: formatPitch(config.pitch),
      },
      {
        responseType: 'blob',
      },
    )

    const audioUrl = URL.createObjectURL(response.data)
    model.stopMotions?.()
    speak(model, audioUrl, {
      onFinish: () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      },
      onError: () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      },
    })
  }

  async function handleSend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const question = draft.trim()
    if (!question) return

    const userMessage: DigitalChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'me',
      name: '我',
      content: question,
      time: new Date(),
      status: 'sent',
    }

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setIsSpeaking(true)
    setStatus('正在生成导览回答...')

    try {
      const chatResponse = await axios.post<GuideChatResponse>('/api/user/guide/chat', {
        sessionId: sessionId || undefined,
        question,
      })

      const nextSessionId = chatResponse.data.sessionId
      setSessionId(nextSessionId)
      window.sessionStorage.setItem(GUIDE_SESSION_KEY, nextSessionId)

      const assistantMessage: DigitalChatMessage = {
        id: `guide-${Date.now()}`,
        sender: 'guide',
        name: '灵山导览数字人',
        content: buildAssistantContent(chatResponse.data),
        time: new Date(),
        status: 'read',
      }
      setMessages((current) => [...current, assistantMessage])
      setStatus('导览回答已生成，正在驱动数字人口型。')
      await speakAnswer(chatResponse.data.answerText)
    } catch (error) {
      console.error(error)
      setIsSpeaking(false)
      setStatus('导览请求失败，请确认问答服务和 TTS 服务已启动。')
      setMessages((current) => [
        ...current,
        {
          id: `guide-error-${Date.now()}`,
          sender: 'guide',
          name: '灵山导览数字人',
          content: '这次导览请求失败了，请稍后再试。',
          time: new Date(),
          status: 'failed',
        },
      ])
    }
  }

  function selectNextModel() {
    const currentIndex = MODEL_OPTIONS.findIndex((model) => model.id === selectedModelId)
    const nextModel = MODEL_OPTIONS[(currentIndex + 1) % MODEL_OPTIONS.length] ?? MODEL_OPTIONS[0]
    setSelectedModelId(nextModel.id)
  }

  function selectNextVoice() {
    const currentIndex = VOICE_OPTIONS.findIndex((voice) => voice.id === config.voiceId)
    const nextVoice = VOICE_OPTIONS[(currentIndex + 1) % VOICE_OPTIONS.length] ?? VOICE_OPTIONS[0]
    setConfig((current) => ({ ...current, voiceId: nextVoice.id }))
    setStatus(`已切换音色：${nextVoice.name}`)
  }

  function handleSelectFactory(factoryId: string) {
    const factory = FACTORY_OPTIONS.find((item) => item.id === factoryId) ?? FACTORY_OPTIONS[0]
    setSelectedFactoryId(factory.id)
    setOpenDropdown(null)
    setStatus(`已切换厂家：${factory.name}`)
  }

  function handleSelectVoice(voiceId: string) {
    const voice = VOICE_OPTIONS.find((item) => item.id === voiceId) ?? VOICE_OPTIONS[0]
    setConfig((current) => ({ ...current, voiceId: voice.id }))
    setOpenDropdown(null)
    setStatus(`已切换音色：${voice.name}`)
  }

  function handleSelectModel(modelId: string) {
    const model = MODEL_OPTIONS.find((item) => item.id === modelId) ?? MODEL_OPTIONS[0]
    setSelectedModelId(model.id)
    setOpenDropdown(null)
  }

  return (
    <main className="module-screen">
      <AppTopNav onLogout={onLogout} />

      <section className="live2d-page live2d-page--presentation">
        <canvas ref={canvasRef} className="live2d-canvas" />
        <div className="digital-human-stage-glow" aria-hidden />
        <div className="digital-human-status" aria-live="polite">
          <span className={isReady ? 'digital-human-status__dot digital-human-status__dot--ready' : 'digital-human-status__dot'} />
          <span>{status}</span>
        </div>

        <aside className="digital-human-chat" aria-label="灵山景区智能导览助手">
          <header className="digital-chat-header">
            <div className="digital-chat-profile">
              <span className="digital-chat-avatar" aria-hidden>灵</span>
              <div className="digital-chat-profile__copy">
                <h1>灵山景区智能导览助手</h1>
                <p>
                  <span className="digital-chat-online-dot" aria-hidden />
                  在线为您服务
                </p>
              </div>
            </div>

            <div ref={chatActionsRef} className="digital-chat-actions" aria-label="导览设置">
              <div className="digital-chat-select">
                <button
                  type="button"
                  disabled={isSpeaking}
                  aria-expanded={openDropdown === 'factory'}
                  onClick={() => setOpenDropdown((current) => (current === 'factory' ? null : 'factory'))}
                >
                  <span>{selectedFactory.name}</span>
                  <span aria-hidden>⌄</span>
                </button>
                {openDropdown === 'factory' ? (
                  <div className="digital-chat-select__menu" role="listbox" aria-label="选择厂家">
                    {FACTORY_OPTIONS.map((factory) => (
                      <button
                        key={factory.id}
                        type="button"
                        className={factory.id === selectedFactory.id ? 'is-active' : undefined}
                        onClick={() => handleSelectFactory(factory.id)}
                        role="option"
                        aria-selected={factory.id === selectedFactory.id}
                      >
                        {factory.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="digital-chat-select">
                <button
                  type="button"
                  disabled={isSpeaking}
                  aria-expanded={openDropdown === 'voice'}
                  onClick={() => setOpenDropdown((current) => (current === 'voice' ? null : 'voice'))}
                >
                  <span>{selectedVoice.name}</span>
                  <span aria-hidden>⌄</span>
                </button>
                {openDropdown === 'voice' ? (
                  <div className="digital-chat-select__menu" role="listbox" aria-label="选择音色">
                    {VOICE_OPTIONS.map((voice) => (
                      <button
                        key={voice.id}
                        type="button"
                        className={voice.id === selectedVoice.id ? 'is-active' : undefined}
                        onClick={() => handleSelectVoice(voice.id)}
                        role="option"
                        aria-selected={voice.id === selectedVoice.id}
                      >
                        {voice.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="digital-chat-select">
                <button
                  type="button"
                  disabled={isSpeaking}
                  aria-expanded={openDropdown === 'model'}
                  onClick={() => setOpenDropdown((current) => (current === 'model' ? null : 'model'))}
                >
                  <span>{selectedModel.name}</span>
                  <span aria-hidden>⌄</span>
                </button>
                {openDropdown === 'model' ? (
                  <div className="digital-chat-select__menu" role="listbox" aria-label="选择模型">
                    {MODEL_OPTIONS.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        className={model.id === selectedModel.id ? 'is-active' : undefined}
                        onClick={() => handleSelectModel(model.id)}
                        role="option"
                        aria-selected={model.id === selectedModel.id}
                      >
                        {model.name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <main className="digital-chat-body" aria-live="polite">
            {messages.map((message) => {
              const isOwn = message.sender === 'me'
              return (
                <article
                  key={message.id}
                  className={isOwn ? 'digital-chat-message digital-chat-message--own' : 'digital-chat-message'}
                >
                  {!isOwn ? <span className="digital-chat-message__avatar" aria-hidden>灵</span> : null}
                  <div className="digital-chat-message__bubble">
                    <div className="digital-chat-message__content">{message.content}</div>
                  </div>
                  <time className="digital-chat-message__time">{formatChatTime(message.time)}</time>
                  {isOwn ? <span className="digital-chat-message__avatar digital-chat-message__avatar--own" aria-hidden>我</span> : null}
                </article>
              )
            })}
            <div ref={messagesEndRef} />
          </main>

          <footer className="digital-chat-composer">
            <form className="digital-chat-form" onSubmit={(event) => void handleSend(event)}>
              <textarea
                value={draft}
                placeholder="请输入您的问题..."
                rows={2}
                disabled={!isReady || isSpeaking}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSend()
                  }
                }}
              />
              <button
                type="button"
                className="digital-chat-voice"
                disabled={isSpeaking}
                onClick={selectNextVoice}
              >
                <span aria-hidden>◉</span>
                <span>语音</span>
              </button>
              <button type="submit" className="digital-chat-send" disabled={!canSend}>
                {isSpeaking ? '发送中' : '发送'}
              </button>
            </form>
          </footer>
        </aside>
      </section>
    </main>
  )
}
