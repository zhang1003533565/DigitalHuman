import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import './DigitalHumanPage.css'
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
  resolveModelUrl,
  speak,
} from '../digitalHuman/shared'
import {
  extractSpeakableSegments,
  joinQuickReplyAndAnswer,
  sanitizeSpeechText,
  stripDuplicateGreeting,
} from '../digitalHuman/streamingSpeech'
import { AppTopNav } from '../components/AppTopNav'

type GuideChatResponse = {
  sessionId: string
  traceId?: string
  answerText: string
}

type DigitalHumanPageProps = {
  onLogout: () => void
}

type DigitalHumanConfig = {
  modelId: string
  costumeId?: string
  voiceId: string
  rate: number
  volume: number
  pitch: number
  welcomeText: string
  guideStyle: string
  broadcastStrategy: string
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

type RuntimeTriggerRule = {
  id?: number
  ruleType: 'MOUSE' | 'KEYWORD' | 'IDLE'
  eventCode?: string
  phrases?: string[]
  actionId: number
  actionName?: string
  motionFilePath?: string
  groupName?: string
  actionIndex?: number
  enabled: boolean
  priority: number
}

type RuntimeDigitalHumanModel = {
  id: number
  modelKey: string
  displayName: string
  modelPath: string
  status: string
  triggerRules?: RuntimeTriggerRule[]
}

type ActionMatchResponse = {
  matched: boolean
  actionId?: number
  actionName?: string
  motionFilePath?: string
  groupName?: string
  actionIndex?: number
  ruleType?: 'MOUSE' | 'KEYWORD' | 'IDLE'
  eventCode?: string
}

type ActionTriggerPayload = {
  eventCode?: string
  text?: string
}

const GUIDE_SESSION_KEY = 'digitalhuman.visitor.guideSessionId'
const SELECTED_MODEL_KEY = 'digitalhuman.visitor.selectedModelId'
const HIGHEST_TRIGGER_PRIORITY = 1
const LOWEST_TRIGGER_PRIORITY = 10
const IDLE_TRIGGER_DELAY_MS = 12000

const DEFAULT_CONFIG: DigitalHumanConfig = {
  modelId: 'hiyori_pro_zh',
  costumeId: 'default',
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

function getStoredSelectedModelId() {
  const modelId = window.sessionStorage.getItem(SELECTED_MODEL_KEY)
  return MODEL_OPTIONS.some((model) => model.id === modelId) ? modelId : null
}

function normalizeTriggerPriority(priority?: number) {
  if (priority === undefined || priority === null) {
    return HIGHEST_TRIGGER_PRIORITY
  }
  return Math.max(HIGHEST_TRIGGER_PRIORITY, Math.min(LOWEST_TRIGGER_PRIORITY, priority))
}

function getTriggerWeight(rule: RuntimeTriggerRule) {
  return LOWEST_TRIGGER_PRIORITY + 1 - normalizeTriggerPriority(rule.priority)
}

function selectWeightedRule(rules: RuntimeTriggerRule[]) {
  const totalWeight = rules.reduce((sum, rule) => sum + getTriggerWeight(rule), 0)
  let cursor = Math.random() * totalWeight
  for (const rule of rules) {
    cursor -= getTriggerWeight(rule)
    if (cursor < 0) {
      return rule
    }
  }
  return rules[rules.length - 1] ?? null
}

export function DigitalHumanPage({ onLogout }: DigitalHumanPageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const chatActionsRef = useRef<HTMLDivElement | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const appRef = useRef<PixiApplication | null>(null)
  const loadIdRef = useRef(0)
  const isMountedRef = useRef(false)
  const dragStartXRef = useRef(0)
  const clickTimerRef = useRef<number | null>(null)
  const lastInteractionAtRef = useRef(0)
  const speechQueueRef = useRef<string[]>([])
  const isAudioPlayingRef = useRef(false)
  const isAnswerStreamingRef = useRef(false)
  const speechRunIdRef = useRef(0)
  const [config, setConfig] = useState<DigitalHumanConfig>(DEFAULT_CONFIG)
  const [selectedModelId, setSelectedModelId] = useState(() => getStoredSelectedModelId() ?? DEFAULT_CONFIG.modelId)
  const [runtimeModels, setRuntimeModels] = useState<RuntimeDigitalHumanModel[]>([])
  const [status, setStatus] = useState('正在加载 Live2D 模型...')
  const [isReady, setIsReady] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [sessionId, setSessionId] = useState(() => window.sessionStorage.getItem(GUIDE_SESSION_KEY) ?? '')
  const [draft, setDraft] = useState('')
  const [selectedFactoryId, setSelectedFactoryId] = useState(FACTORY_OPTIONS[0].id)
  const [openDropdown, setOpenDropdown] = useState<DigitalChatDropdownKey | null>(null)
  const [messages, setMessages] = useState<DigitalChatMessage[]>(() => [
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
  const selectedRuntimeModel = runtimeModels.find((model) => model.modelKey === selectedModel.id)

  const selectedVoice =
    VOICE_OPTIONS.find((voice) => voice.id === config.voiceId) ??
    VOICE_OPTIONS[0]

  const selectedFactory =
    FACTORY_OPTIONS.find((factory) => factory.id === selectedFactoryId) ??
    FACTORY_OPTIONS[0]

  const canSend = isReady && !isSpeaking && draft.trim().length > 0

  const markInteraction = useCallback(() => {
    lastInteractionAtRef.current = Date.now()
  }, [])

  useEffect(() => {
    markInteraction()
  }, [markInteraction])

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
    async function loadRuntimeModels() {
      try {
        const response = await axios.get<RuntimeDigitalHumanModel[]>('/api/user/digital-human/models')
        setRuntimeModels(response.data)
      } catch (error) {
        console.warn('Load digital human action rules failed', error)
        setRuntimeModels([])
      }
    }

    void loadRuntimeModels()

    // 定时刷新配置，每 30 秒检查一次更新
    const refreshInterval = setInterval(() => {
      void loadRuntimeModels()
    }, 30000)

    return () => {
      clearInterval(refreshInterval)
    }
  }, [])

  useEffect(() => {
    async function refreshDigitalHumanConfig() {
      try {
        const response = await axios.get<DigitalHumanConfig>('/api/user/digital-human/config')
        const nextConfig = { ...DEFAULT_CONFIG, ...response.data }
        setConfig(nextConfig)
        setSelectedModelId(nextConfig.modelId)
      } catch (error) {
        console.warn('Refresh digital human config failed', error)
      }
    }

    const refreshInterval = setInterval(() => {
      void refreshDigitalHumanConfig()
    }, 8000)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshDigitalHumanConfig()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
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

  const playConfiguredMotion = useCallback((action?: Pick<ActionMatchResponse, 'matched' | 'actionName' | 'groupName' | 'actionIndex'>) => {
    const model = modelRef.current
    if (!model || !action?.matched || action.actionIndex === undefined || action.actionIndex === null) {
      return false
    }

    try {
      model.stopMotions?.()
      ;(model.motion as (groupName: string, index?: number, priority?: number) => void)(
        action.groupName ?? '',
        action.actionIndex,
        3,
      )
      if (action.actionName) {
        setStatus(`已触发动作：${action.actionName}`)
      }
      return true
    } catch (error) {
      console.warn('Configured action failed', action, error)
      return false
    }
  }, [])

  const findLocalRuleMatch = useCallback((payload: ActionTriggerPayload) => {
    const rules = [...(selectedRuntimeModel?.triggerRules ?? [])]
      .filter((rule) => rule.enabled)
      .sort((left, right) => (left.priority - right.priority) || ((left.id ?? 0) - (right.id ?? 0)))

    const text = payload.text?.trim() ?? ''
    const eventCode = payload.eventCode?.trim() ?? ''

    const matchedRules = rules.filter((rule) => {
      if (rule.ruleType === 'MOUSE') {
        return eventCode && rule.eventCode === eventCode
      }
      if (rule.ruleType === 'IDLE') {
        return eventCode === 'IDLE'
      }
      if (rule.ruleType === 'KEYWORD') {
        return Boolean(text) && (rule.phrases ?? []).some((phrase) => text.includes(phrase))
      }
      return false
    })

    if (!matchedRules.length) {
      return null
    }

    return selectWeightedRule(matchedRules)
  }, [selectedRuntimeModel])

  const triggerConfiguredAction = useCallback(async (payload: ActionTriggerPayload) => {
    const modelKey = selectedRuntimeModel?.modelKey ?? selectedModel.id
    if (!modelKey) {
      return false
    }

    try {
      const response = await axios.post<ActionMatchResponse>('/api/user/digital-human/action-match', {
        modelKey,
        ...payload,
      })
      if (playConfiguredMotion(response.data)) {
        return true
      }
    } catch (error) {
      console.warn('Action match API failed, falling back to local rules', error)
    }

    const localRule = findLocalRuleMatch(payload)
    return playConfiguredMotion(localRule ? { matched: true, ...localRule } : undefined)
  }, [findLocalRuleMatch, playConfiguredMotion, selectedModel.id, selectedRuntimeModel])

  useEffect(() => {
    if (!isReady || isSpeaking) {
      return
    }

    const hasIdleRule = (selectedRuntimeModel?.triggerRules ?? [])
      .some((rule) => rule.enabled && rule.ruleType === 'IDLE')
    if (!hasIdleRule) {
      return
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastInteractionAtRef.current < IDLE_TRIGGER_DELAY_MS) {
        return
      }
      lastInteractionAtRef.current = Date.now()
      void triggerConfiguredAction({ eventCode: 'IDLE' })
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [isReady, isSpeaking, selectedRuntimeModel?.triggerRules, triggerConfiguredAction])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }

    function clearClickTimer() {
      if (clickTimerRef.current !== null) {
        window.clearTimeout(clickTimerRef.current)
        clickTimerRef.current = null
      }
    }

    function handleClick(event: MouseEvent) {
      if (event.button === 0 && event.detail === 1) {
        markInteraction()
        clearClickTimer()
        clickTimerRef.current = window.setTimeout(() => {
          clickTimerRef.current = null
          void triggerConfiguredAction({ eventCode: 'CLICK_LEFT' })
        }, 240)
      }
    }

    function handleDoubleClick() {
      markInteraction()
      clearClickTimer()
      void triggerConfiguredAction({ eventCode: 'DOUBLE_CLICK_LEFT' })
    }

    function handleContextMenu(event: MouseEvent) {
      markInteraction()
      clearClickTimer()
      event.preventDefault()
      void triggerConfiguredAction({ eventCode: 'RIGHT_CLICK' })
    }

    function handleWheel(event: WheelEvent) {
      markInteraction()
      if (event.deltaY < 0) {
        void triggerConfiguredAction({ eventCode: 'WHEEL_UP' })
      }
    }

    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('dblclick', handleDoubleClick)
    canvas.addEventListener('contextmenu', handleContextMenu)
    canvas.addEventListener('wheel', handleWheel, { passive: true })
    return () => {
      clearClickTimer()
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('dblclick', handleDoubleClick)
      canvas.removeEventListener('contextmenu', handleContextMenu)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [markInteraction, triggerConfiguredAction])

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

        const model = await window.PIXI.live2d.Live2DModel.from(resolveModelUrl(selectedModel, config.costumeId))

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

        makeDraggable(model, {
          onDragStart: () => {
            markInteraction()
            dragStartXRef.current = model.x
          },
          onDragEnd: () => {
            markInteraction()
            const deltaX = model.x - dragStartXRef.current
            if (Math.abs(deltaX) >= 24) {
              void triggerConfiguredAction({ eventCode: deltaX < 0 ? 'SLIDE_LEFT' : 'SLIDE_RIGHT' })
            }
          },
        })

        model.on('hit', (...args: unknown[]) => {
          const hitAreas = Array.isArray(args[0]) ? (args[0] as string[]) : []

          if (hitAreas.includes('Body') && selectedModel.bodyMotionGroup) {
            const hasConfiguredClick = (selectedRuntimeModel?.triggerRules ?? [])
              .some((rule) => rule.enabled && rule.ruleType === 'MOUSE' && rule.eventCode === 'CLICK_LEFT')
            if (!hasConfiguredClick) {
              model.motion(selectedModel.bodyMotionGroup)
            }
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
    config.costumeId,
    selectedModel.bodyMotionGroup,
    selectedModel.scaleMultiplier,
    selectedModel.xOffsetRatio,
    selectedModel.yOffsetRatio,
    selectedRuntimeModel?.triggerRules,
    markInteraction,
    triggerConfiguredAction,
  ])

  function resetSpeechQueue() {
    speechRunIdRef.current += 1
    speechQueueRef.current = []
    isAudioPlayingRef.current = false
    modelRef.current?.stopSpeaking?.()
  }

  function enqueueSpeechSegments(segments: string[]) {
    const cleanSegments = segments.map((segment) => sanitizeSpeechText(segment)).filter(Boolean)
    if (!cleanSegments.length) return

    speechQueueRef.current.push(...cleanSegments)
    void playNextSpeechSegment(speechRunIdRef.current)
  }

  async function playNextSpeechSegment(runId: number) {
    if (isAudioPlayingRef.current || runId !== speechRunIdRef.current) return

    const nextText = speechQueueRef.current.shift()
    if (!nextText) {
      if (!isAnswerStreamingRef.current) {
        setIsSpeaking(false)
        setStatus('导览回答已生成。')
      }
      return
    }

    await speakTextSegment(nextText, runId)
  }

  async function speakTextSegment(text: string, runId: number) {
    const model = modelRef.current
    if (!model || !text.trim() || runId !== speechRunIdRef.current) return

    isAudioPlayingRef.current = true
    setStatus('正在分段合成并播放导览语音。')

    try {
      const response = await axios.post(
        TTS_ENDPOINT,
        {
          text,
          voice: selectedVoice.id,
          rate: formatPercent(config.rate),
          volume: formatPercent(config.volume),
          pitch: formatPitch(config.pitch),
        },
        {
          responseType: 'blob',
        },
      )

      if (runId !== speechRunIdRef.current) return

      const audioUrl = URL.createObjectURL(response.data)
      model.stopMotions?.()
      speak(model, audioUrl, {
        onFinish: () => {
          markInteraction()
          URL.revokeObjectURL(audioUrl)
          isAudioPlayingRef.current = false
          void playNextSpeechSegment(runId)
        },
        onError: () => {
          markInteraction()
          URL.revokeObjectURL(audioUrl)
          isAudioPlayingRef.current = false
          void playNextSpeechSegment(runId)
        },
      })
    } catch (error) {
      console.error(error)
      isAudioPlayingRef.current = false
      if (runId === speechRunIdRef.current && speechQueueRef.current.length) {
        void playNextSpeechSegment(runId)
      } else if (runId === speechRunIdRef.current && !isAnswerStreamingRef.current) {
        setIsSpeaking(false)
      }
    }
  }

  async function handleSend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const question = draft.trim()
    if (!question) return
    markInteraction()

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
    resetSpeechQueue()
    isAnswerStreamingRef.current = true
    void triggerConfiguredAction({ text: question })

    const assistantMsgId = `guide-${Date.now()}`
    let quickReplyText = ''

    setMessages((current) => [
      ...current,
      {
        id: assistantMsgId,
        sender: 'guide',
        name: '灵山导览数字人',
        content: joinQuickReplyAndAnswer('', '', { pending: true }),
        time: new Date(),
        status: 'read',
      },
    ])

    try {
      console.log('[stream] 开始请求流式接口')
      const authHeader = axios.defaults.headers.common.Authorization as string | undefined
      let fullAnswer = ''
      let nextSessionId = sessionId
      let chunkCount = 0
      let streamError = ''
      let speechBuffer = ''
      let speakableAnswer = ''
      let quickReplySettled = false

      const queueAnswerSpeech = (flush = false) => {
        const nextSpeakableAnswer = stripDuplicateGreeting(quickReplyText, fullAnswer)
        if (nextSpeakableAnswer.length < speakableAnswer.length) {
          speakableAnswer = nextSpeakableAnswer
          speechBuffer = ''
          return
        }

        const delta = nextSpeakableAnswer.slice(speakableAnswer.length)
        speakableAnswer = nextSpeakableAnswer
        if (delta) {
          speechBuffer += delta
        }

        const extracted = extractSpeakableSegments(speechBuffer, {
          minChars: 20,
          maxChars: 46,
          flush,
        })
        speechBuffer = extracted.rest
        enqueueSpeechSegments(extracted.segments)
      }

      const quickReplyPromise = axios
        .post<GuideChatResponse>('/api/user/guide/chat/quick', {
          sessionId: sessionId || undefined,
          question,
        }, { timeout: 5000 })
        .then((response) => response.data.answerText.trim())
        .catch((error) => {
          console.warn('[quick] 短答生成失败:', error)
          return ''
        })

      quickReplyPromise.then((quickReply) => {
        quickReplySettled = true
        if (quickReply) {
          quickReplyText = quickReply
          setMessages((current) =>
            current.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, content: joinQuickReplyAndAnswer(quickReplyText, fullAnswer, { pending: !fullAnswer.trim() }) }
                : msg
            )
          )
          enqueueSpeechSegments([quickReply])
        }
        queueAnswerSpeech()
      })

      const response = await fetch('/api/user/guide/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify({
          sessionId: sessionId || undefined,
          question,
        }),
      })

      console.log('[stream] 响应状态:', response.status, response.headers.get('content-type'))

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      // 逐行解析 SSE
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunkCount++
        const text = decoder.decode(value, { stream: true })
        console.log(`[stream] chunk #${chunkCount}:`, text.slice(0, 200))
        buffer += text
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim() || line.startsWith('event:')) continue
          if (!line.startsWith('data:')) continue

          const dataStr = line.slice(5).trim()
          if (dataStr === '[DONE]') {
            console.log('[stream] 收到 [DONE] 信号')
            continue
          }

          try {
            const parsed = JSON.parse(dataStr)

            // meta 事件：包含 sessionId
            if (parsed.sessionId) {
              console.log('[stream] meta:', parsed.sessionId)
              nextSessionId = parsed.sessionId
              setSessionId(nextSessionId)
              window.sessionStorage.setItem(GUIDE_SESSION_KEY, nextSessionId)
            }

            // token 事件：逐字输出
            if (parsed.token) {
              fullAnswer += parsed.token
              const currentText = joinQuickReplyAndAnswer(quickReplyText, fullAnswer)
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: currentText } : msg
                )
              )
              if (quickReplySettled) {
                queueAnswerSpeech()
              }
            }

            // error 事件
            if (parsed.error) {
              console.error('[stream] error:', parsed.error)
              streamError = String(parsed.error)
              setStatus(streamError)
              if (!parsed.token) {
                enqueueSpeechSegments([streamError])
              }
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: joinQuickReplyAndAnswer(quickReplyText, streamError), status: 'failed' as const }
                    : msg
                )
              )
            }
          } catch {
            console.warn('[stream] JSON 解析失败:', dataStr)
          }
        }
      }

      console.log(`[stream] 流结束, 共 ${chunkCount} 个 chunk, 回答长度: ${fullAnswer.length}`)
      if (!quickReplySettled) {
        await quickReplyPromise
      }
      queueAnswerSpeech(true)

      if (!fullAnswer.trim()) {
        const fallbackMessage = streamError || '当前主智能体暂时不可用，请确认 ai-service 已启动，并在后台完成 CHAT 模型配置。'
        setStatus(fallbackMessage)
        enqueueSpeechSegments([fallbackMessage])
        setMessages((current) =>
          current.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: joinQuickReplyAndAnswer(quickReplyText, fallbackMessage), status: 'failed' as const }
              : msg
          )
        )
        isAnswerStreamingRef.current = false
        void playNextSpeechSegment(speechRunIdRef.current)
        return
      }

      setStatus('导览回答已生成，语音正在分段播放。')
      void triggerConfiguredAction({ text: `${question}\n${fullAnswer}` })
      isAnswerStreamingRef.current = false
      void playNextSpeechSegment(speechRunIdRef.current)
    } catch (error) {
      console.error(error)
      isAnswerStreamingRef.current = false
      setStatus('导览请求失败，请确认问答服务和 TTS 服务已启动。')
      enqueueSpeechSegments(['这次导览请求失败了，请稍后再试。'])
      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: joinQuickReplyAndAnswer(quickReplyText, '这次导览请求失败了，请稍后再试。'), status: 'failed' as const }
            : msg
        )
      )
      void playNextSpeechSegment(speechRunIdRef.current)
    }
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
    window.sessionStorage.setItem(SELECTED_MODEL_KEY, model.id)
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
