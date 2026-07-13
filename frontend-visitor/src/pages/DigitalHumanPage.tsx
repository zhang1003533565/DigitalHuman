import { type FormEvent, type MouseEvent as ReactMouseEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
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
  stopSpeech,
} from '../digitalHuman/shared'
import {
  extractSpeakableSegments,
  resolveStreamOutcome,
  sanitizeAnswerText,
  sanitizeSpeechText,
} from '../digitalHuman/streamingSpeech'
import { GuideResultCards } from '../components/GuideResultCards'
import { normalizeGuideChatResult, type GuideChatResult } from '../api/contracts'
import {
  MOBILE_LIVE_QUICK_QUESTIONS,
  getMobileLiveComments,
  shouldHideMobileLiveCommentOnShortViewport,
} from '../digitalHuman/mobileLive'
import { invalidateSpeechRecognition } from '../digitalHuman/speechRecognitionLifecycle'

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
  result?: GuideChatResult
  messageId?: number
}

export type GuideRuntimeState = 'loading' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

type SpeechQueueItem = {
  id: number
  text: string
  audioUrl?: string
  promise?: Promise<string | null>
  failed?: boolean
}

type SpeechRecognitionResultEvent = Event & { results: { 0: { 0: { transcript: string } } } }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  start: () => void
  stop?: () => void
  abort?: () => void
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

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
const SPEECH_PREFETCH_LIMIT = 2
const MOBILE_DIALOG_FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not(:disabled):not([tabindex="-1"])',
  'input:not(:disabled):not([tabindex="-1"])',
  'select:not(:disabled):not([tabindex="-1"])',
  'textarea:not(:disabled):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(', ')

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

type DigitalChatMessageArticleProps = {
  message: DigitalChatMessage
  onSuggestion: (suggestion: string) => void
}

function DigitalChatMessageArticle({ message, onSuggestion }: DigitalChatMessageArticleProps) {
  const isOwn = message.sender === 'me'
  return (
    <article className={isOwn ? 'digital-chat-message digital-chat-message--own' : 'digital-chat-message'}>
      {!isOwn ? <span className="digital-chat-message__avatar" aria-hidden>灵</span> : null}
      <div className="digital-chat-message__bubble">
        <div className="digital-chat-message__content">{message.content}</div>
        {message.result ? (
          <GuideResultCards
            result={message.result}
            messageId={message.messageId}
            onSuggestion={onSuggestion}
          />
        ) : null}
      </div>
      <time className="digital-chat-message__time">{formatChatTime(message.time)}</time>
      {isOwn ? <span className="digital-chat-message__avatar digital-chat-message__avatar--own" aria-hidden>我</span> : null}
    </article>
  )
}

export function DigitalHumanPage() {
  const livePageRef = useRef<HTMLElement | null>(null)
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
  const speechQueueRef = useRef<SpeechQueueItem[]>([])
  const speechItemIdRef = useRef(0)
  const speechHandoffTimerRef = useRef<number | null>(null)
  const isAudioPlayingRef = useRef(false)
  const isAudioStartingRef = useRef(false)
  const isAnswerStreamingRef = useRef(false)
  const speechRunIdRef = useRef(0)
  const speechOutcomeRef = useRef<ReturnType<typeof resolveStreamOutcome>>({
    state: 'success',
    status: '导览回答已生成。',
  })
  const backendModelIdRef = useRef<string | null>(null)
  const mobileHistoryReturnFocusRef = useRef<HTMLElement | null>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement | null>(null)
  const historyPanelRef = useRef<HTMLElement | null>(null)
  const settingsPanelRef = useRef<HTMLElement | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recognitionGenerationRef = useRef(0)
  const [config, setConfig] = useState<DigitalHumanConfig>(DEFAULT_CONFIG)
  const [selectedModelId, setSelectedModelId] = useState(() => getStoredSelectedModelId() ?? DEFAULT_CONFIG.modelId)
  const [runtimeModels, setRuntimeModels] = useState<RuntimeDigitalHumanModel[]>([])
  const [status, setStatus] = useState('正在加载 Live2D 模型...')
  const [isReady, setIsReady] = useState(false)
  const [runtimeState, setRuntimeState] = useState<GuideRuntimeState>('loading')
  const [sessionId, setSessionId] = useState(() => window.sessionStorage.getItem(GUIDE_SESSION_KEY) ?? '')
  const [draft, setDraft] = useState('')
  const [selectedFactoryId, setSelectedFactoryId] = useState(FACTORY_OPTIONS[0].id)
  const [openDropdown, setOpenDropdown] = useState<DigitalChatDropdownKey | null>(null)
  const [isMobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  const [isMobileSettingsOpen, setMobileSettingsOpen] = useState(false)
  const [mobileHistoryTargetId, setMobileHistoryTargetId] = useState<string | null>(null)
  const [mobileLiveAnnouncement, setMobileLiveAnnouncement] = useState('')
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
  const selectedModelIdRef = useRef(selectedModel.id)
  const selectedRuntimeModelRef = useRef<RuntimeDigitalHumanModel | undefined>(selectedRuntimeModel)

  const selectedVoice =
    VOICE_OPTIONS.find((voice) => voice.id === config.voiceId) ??
    VOICE_OPTIONS[0]

  const selectedFactory =
    FACTORY_OPTIONS.find((factory) => factory.id === selectedFactoryId) ??
    FACTORY_OPTIONS[0]

  const isSpeaking = runtimeState === 'speaking'

  const canSend = isReady && draft.trim().length > 0

  const mobileRuntimeComment: DigitalChatMessage | null = ['loading', 'listening', 'thinking', 'error'].includes(runtimeState)
    ? {
        id: `runtime-${runtimeState}`,
        sender: 'guide',
        name: '灵灵状态',
        content: status,
        time: new Date(),
        status: runtimeState === 'error' ? 'failed' : 'read',
      }
    : null
  const mobileLiveComments = getMobileLiveComments(messages, mobileRuntimeComment)

  const closeMobileHistory = useCallback(() => {
    setMobileHistoryOpen(false)
    window.requestAnimationFrame(() => mobileHistoryReturnFocusRef.current?.focus())
  }, [])

  const closeMobileSettings = useCallback(() => {
    setMobileSettingsOpen(false)
    window.requestAnimationFrame(() => settingsTriggerRef.current?.focus())
  }, [])

  function openMobileHistory(messageId: string | undefined, trigger: HTMLElement) {
    mobileHistoryReturnFocusRef.current = trigger
    setMobileHistoryTargetId(messageId ?? null)
    setMobileHistoryOpen(true)
  }

  useEffect(() => {
    selectedModelIdRef.current = selectedModel.id
    selectedRuntimeModelRef.current = selectedRuntimeModel
  }, [selectedModel.id, selectedRuntimeModel])

  const applyDigitalHumanConfig = useCallback((nextConfig: DigitalHumanConfig) => {
    setConfig(nextConfig)

    const previousBackendModelId = backendModelIdRef.current
    const backendModelChanged =
      previousBackendModelId !== null &&
      previousBackendModelId !== nextConfig.modelId

    backendModelIdRef.current = nextConfig.modelId

    if (backendModelChanged) {
      window.sessionStorage.removeItem(SELECTED_MODEL_KEY)
      setSelectedModelId(nextConfig.modelId)
      return
    }

    setSelectedModelId(getStoredSelectedModelId() ?? nextConfig.modelId)
  }, [])

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
        applyDigitalHumanConfig(nextConfig)
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
  }, [applyDigitalHumanConfig])

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
  }, [])

  useEffect(() => {
    if (window.matchMedia('(min-width: 769px)').matches) {
      messagesEndRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages.length, isSpeaking])

  useEffect(() => {
    const viewport = window.visualViewport

    function syncMobileViewport() {
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportOffsetTop = viewport?.offsetTop ?? 0
      const viewportBottomInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop)
      const page = livePageRef.current

      if (!page) return

      page.style.setProperty('--digital-mobile-viewport-height', `${viewportHeight}px`)
      page.style.setProperty('--digital-mobile-viewport-offset-top', `${viewportOffsetTop}px`)
      page.style.setProperty('--digital-mobile-viewport-bottom-inset', `${viewportBottomInset}px`)
    }

    syncMobileViewport()
    viewport?.addEventListener('resize', syncMobileViewport)
    viewport?.addEventListener('scroll', syncMobileViewport)
    window.addEventListener('resize', syncMobileViewport)

    return () => {
      viewport?.removeEventListener('resize', syncMobileViewport)
      viewport?.removeEventListener('scroll', syncMobileViewport)
      window.removeEventListener('resize', syncMobileViewport)
    }
  }, [])

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
    if (!isMobileHistoryOpen && !isMobileSettingsOpen) return
    const panel = isMobileHistoryOpen ? historyPanelRef.current : settingsPanelRef.current
    panel?.querySelector<HTMLElement>(MOBILE_DIALOG_FOCUSABLE_SELECTOR)?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isMobileHistoryOpen) closeMobileHistory()
        if (isMobileSettingsOpen) closeMobileSettings()
        return
      }
      if (event.key === 'Tab' && panel) {
        const focusable = [...panel.querySelectorAll<HTMLElement>(MOBILE_DIALOG_FOCUSABLE_SELECTOR)]
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeMobileHistory, closeMobileSettings, isMobileHistoryOpen, isMobileSettingsOpen])

  useEffect(() => {
    if (!isMobileHistoryOpen || !mobileHistoryTargetId) return
    window.requestAnimationFrame(() => {
      document.getElementById(`mobile-history-${mobileHistoryTargetId}`)?.scrollIntoView({ block: 'center' })
    })
  }, [isMobileHistoryOpen, mobileHistoryTargetId])

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
    const rules = [...(selectedRuntimeModelRef.current?.triggerRules ?? [])]
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
  }, [])

  const triggerConfiguredAction = useCallback(async (payload: ActionTriggerPayload) => {
    const modelKey = selectedRuntimeModelRef.current?.modelKey ?? selectedModelIdRef.current
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
  }, [findLocalRuleMatch, playConfiguredMotion])

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
      invalidateSpeechRecognition(recognitionRef, recognitionGenerationRef)
      if (modelRef.current) {
        stopSpeech(modelRef.current)
      }
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
        setRuntimeState('loading')
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
          stopSpeech(currentModel)
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
            const hasConfiguredClick = (selectedRuntimeModelRef.current?.triggerRules ?? [])
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
        setRuntimeState('idle')
        setStatus(`${selectedModel.name} 已就绪，可以开始导览问答。`)
      } catch (error) {
        console.error(error)
        appRef.current?.start()
        setStatus(`${selectedModel.name} 加载失败，请检查 public/live2d 资源是否完整。`)
        setRuntimeState('error')
      }
    }

    void loadSelectedModel()

    return () => {
      if (loadId === loadIdRef.current) {
        appRef.current?.start()
      }
    }
  }, [
    selectedModel,
    config.costumeId,
    markInteraction,
    triggerConfiguredAction,
  ])

  function resetSpeechQueue() {
    speechRunIdRef.current += 1
    if (speechHandoffTimerRef.current !== null) {
      window.clearTimeout(speechHandoffTimerRef.current)
      speechHandoffTimerRef.current = null
    }
    speechQueueRef.current.forEach((item) => {
      if (item.audioUrl) {
        URL.revokeObjectURL(item.audioUrl)
      }
    })
    speechQueueRef.current = []
    isAudioPlayingRef.current = false
    isAudioStartingRef.current = false
    if (modelRef.current) {
      stopSpeech(modelRef.current)
    }
  }

  function scheduleNextSpeechSegment(runId: number) {
    if (runId !== speechRunIdRef.current) return

    if (speechHandoffTimerRef.current !== null) {
      window.clearTimeout(speechHandoffTimerRef.current)
    }

    isAudioStartingRef.current = true
    speechHandoffTimerRef.current = window.setTimeout(() => {
      speechHandoffTimerRef.current = null
      isAudioStartingRef.current = false
      if (runId === speechRunIdRef.current) {
        void playNextSpeechSegment(runId)
      }
    }, 48)
  }

  function enqueueSpeechSegments(
    segments: string[],
    runId = speechRunIdRef.current,
  ) {
    if (runId !== speechRunIdRef.current) return

    const cleanSegments = segments.map((segment) => sanitizeSpeechText(segment)).filter(Boolean)
    if (!cleanSegments.length) return

    speechQueueRef.current.push(...cleanSegments.map((text) => ({
      id: speechItemIdRef.current += 1,
      text,
    })))
    prefetchSpeechSegments(runId)
    void playNextSpeechSegment(runId)
  }

  function prefetchSpeechSegments(runId: number) {
    if (runId !== speechRunIdRef.current) return

    const nextItem = speechQueueRef.current[0]
    if (nextItem) {
      startSpeechSynthesisForItem(nextItem, runId)
    }

    const pendingCount = speechQueueRef.current.filter((item) => item.promise && !item.audioUrl && !item.failed).length
    let availableSlots = Math.max(0, SPEECH_PREFETCH_LIMIT - pendingCount)
    if (!availableSlots) return

    for (const item of speechQueueRef.current) {
      if (!availableSlots) break
      if (item.audioUrl || item.promise || item.failed) continue

      startSpeechSynthesisForItem(item, runId)
      availableSlots -= 1
    }
  }

  function startSpeechSynthesisForItem(item: SpeechQueueItem, runId: number) {
    if (item.audioUrl || item.promise || item.failed || runId !== speechRunIdRef.current) return

    item.promise = synthesizeSpeechSegment(item.text, runId)
      .then((audioUrl) => {
        if (runId !== speechRunIdRef.current) {
          if (audioUrl) {
            URL.revokeObjectURL(audioUrl)
          }
          return null
        }

        item.audioUrl = audioUrl ?? undefined
        item.failed = !audioUrl
        return audioUrl
      })
      .catch((error) => {
        console.error(error)
        item.failed = true
        return null
      })
  }

  async function playNextSpeechSegment(runId: number) {
    if (isAudioPlayingRef.current || isAudioStartingRef.current || runId !== speechRunIdRef.current) return

    isAudioStartingRef.current = true

    prefetchSpeechSegments(runId)

    const nextItem = speechQueueRef.current[0]
    if (!nextItem) {
      isAudioStartingRef.current = false
      if (!isAnswerStreamingRef.current) {
        const outcome = speechOutcomeRef.current
        setRuntimeState(outcome.state === 'error' ? 'error' : 'idle')
        setStatus(outcome.status)
      }
      return
    }

    startSpeechSynthesisForItem(nextItem, runId)
    const audioUrl = nextItem.audioUrl ?? await nextItem.promise
    if (runId !== speechRunIdRef.current) {
      isAudioStartingRef.current = false
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      return
    }

    if (!audioUrl || nextItem.failed) {
      isAudioStartingRef.current = false
      speechQueueRef.current.shift()
      prefetchSpeechSegments(runId)
      void playNextSpeechSegment(runId)
      return
    }

    playSynthesizedSpeechSegment(nextItem, audioUrl, runId)
  }

  async function synthesizeSpeechSegment(text: string, runId: number) {
    const cleanText = sanitizeSpeechText(text)
    if (!cleanText || runId !== speechRunIdRef.current) return null

    setStatus('正在分段合成并播放导览语音。')

    const response = await axios.post(
      TTS_ENDPOINT,
      {
        text: cleanText,
        voice: selectedVoice.id,
        rate: formatPercent(config.rate),
        volume: formatPercent(config.volume),
        pitch: formatPitch(config.pitch),
      },
      {
        responseType: 'blob',
      },
    )

    if (runId !== speechRunIdRef.current) return null
    return URL.createObjectURL(response.data)
  }

  function playSynthesizedSpeechSegment(item: SpeechQueueItem, audioUrl: string, runId: number) {
    const model = modelRef.current
    if (!model || runId !== speechRunIdRef.current) {
      isAudioStartingRef.current = false
      return
    }

    isAudioStartingRef.current = false
    isAudioPlayingRef.current = true
    setRuntimeState('speaking')
    setStatus('正在播放导览语音。')
    prefetchSpeechSegments(runId)

    model.stopMotions?.()
    speak(model, audioUrl, {
      onFinish: () => {
        markInteraction()
        URL.revokeObjectURL(audioUrl)
        if (speechQueueRef.current[0]?.id === item.id) {
          speechQueueRef.current.shift()
        }
        isAudioPlayingRef.current = false
        prefetchSpeechSegments(runId)
        scheduleNextSpeechSegment(runId)
      },
      onError: () => {
        markInteraction()
        URL.revokeObjectURL(audioUrl)
        if (speechQueueRef.current[0]?.id === item.id) {
          speechQueueRef.current.shift()
        }
        isAudioPlayingRef.current = false
        prefetchSpeechSegments(runId)
        scheduleNextSpeechSegment(runId)
      },
    })
  }

  function handleSend(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    void sendQuestion(draft)
  }

  function handleMobileQuickQuestion(event: ReactMouseEvent<HTMLButtonElement>) {
    void sendQuestion(event.currentTarget.dataset.question ?? '')
  }

  function startVoiceQuestion() {
    const SpeechRecognition = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }).SpeechRecognition ?? (window as typeof window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setRuntimeState('error')
      setStatus('当前浏览器未提供语音识别，请使用文字提问。')
      return
    }

    invalidateSpeechRecognition(recognitionRef, recognitionGenerationRef)
    const generation = recognitionGenerationRef.current
    const recognition = new SpeechRecognition()
    let hadRecognitionError = false
    let recognizedTranscript = ''
    recognitionRef.current = recognition
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.onresult = (event) => {
      if (recognitionGenerationRef.current === generation) {
        recognizedTranscript = event.results[0][0].transcript
        setDraft(recognizedTranscript)
      }
    }
    recognition.onerror = () => {
      if (recognitionGenerationRef.current !== generation || recognitionRef.current !== recognition) return
      hadRecognitionError = true
      invalidateSpeechRecognition(recognitionRef, recognitionGenerationRef, false)
      setRuntimeState('error')
      setStatus('没有识别到语音，请重试或使用文字提问。')
      setMobileLiveAnnouncement('语音识别失败，请重试或使用文字提问。')
    }
    recognition.onend = () => {
      if (recognitionGenerationRef.current !== generation || recognitionRef.current !== recognition) return
      invalidateSpeechRecognition(recognitionRef, recognitionGenerationRef, false)
      if (!hadRecognitionError) {
        setRuntimeState('idle')
        setStatus(recognizedTranscript ? '语音问题已识别，可以发送。' : '语音识别已结束，请重新尝试。')
        setMobileLiveAnnouncement(recognizedTranscript ? '语音问题已识别。' : '语音识别已结束。')
      }
    }
    try {
      recognition.start()
      setRuntimeState('listening')
      setStatus('正在聆听您的问题…')
    } catch {
      invalidateSpeechRecognition(recognitionRef, recognitionGenerationRef, false)
      setRuntimeState('error')
      setStatus('语音识别启动失败，请重试或使用文字提问。')
      setMobileLiveAnnouncement('语音识别启动失败，请重试或使用文字提问。')
    }
  }

  async function sendQuestion(questionInput: string) {
    invalidateSpeechRecognition(recognitionRef, recognitionGenerationRef)
    const question = questionInput.trim()
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
    setMobileLiveAnnouncement('已发送问题，灵灵正在回复。')
    setRuntimeState('thinking')
    speechOutcomeRef.current = { state: 'success', status: '导览回答已生成。' }
    setStatus('正在生成导览回答...')
    resetSpeechQueue()
    const requestRunId = speechRunIdRef.current
    const isCurrentRequest = () => requestRunId === speechRunIdRef.current
    const enqueueCurrentSpeechSegments = (segments: string[]) => enqueueSpeechSegments(segments, requestRunId)
    isAnswerStreamingRef.current = true
    void triggerConfiguredAction({ text: question })

    const assistantMsgId = `guide-${Date.now()}`

    setMessages((current) => [
      ...current,
      {
        id: assistantMsgId,
        sender: 'guide',
        name: '灵山导览数字人',
        content: '...',
        time: new Date(),
        status: 'read',
      },
    ])

    try {
      const authHeader = axios.defaults.headers.common.Authorization as string | undefined
      let fullAnswer = ''
      let nextSessionId = sessionId
      let streamError = ''
      let speechBuffer = ''
      let speakableAnswer = ''
      let mainSpeechSegmentCount = 0
      let guideResult = normalizeGuideChatResult({})

      const queueAnswerSpeech = (flush = false) => {
        if (!isCurrentRequest()) return

        const nextSpeakableAnswer = sanitizeSpeechText(fullAnswer)
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

        const isFirstMainSegment = mainSpeechSegmentCount === 0
        const extracted = extractSpeakableSegments(speechBuffer, {
          minChars: isFirstMainSegment ? 40 : 80,
          maxChars: isFirstMainSegment ? 56 : 96,
          flush,
        })
        speechBuffer = extracted.rest
        mainSpeechSegmentCount += extracted.segments.length
        enqueueCurrentSpeechSegments(extracted.segments)
      }

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

      if (!response.ok || !response.body) {
        throw new Error(`Stream request failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      // 逐行解析 SSE
      let buffer = ''
      while (true) {
        if (!isCurrentRequest()) {
          await reader.cancel().catch(() => undefined)
          break
        }

        const { done, value } = await reader.read()
        if (done) break
        if (!isCurrentRequest()) {
          await reader.cancel().catch(() => undefined)
          break
        }

        const text = decoder.decode(value, { stream: true })
        buffer += text
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim() || line.startsWith('event:')) continue
          if (!line.startsWith('data:')) continue

          const dataStr = line.slice(5).trim()
          if (dataStr === '[DONE]') {
            continue
          }

          try {
            const parsed = JSON.parse(dataStr)

            // meta 事件：包含 sessionId
            if (parsed.sessionId) {
              nextSessionId = parsed.sessionId
              setSessionId(nextSessionId)
              window.sessionStorage.setItem(GUIDE_SESSION_KEY, nextSessionId)
            }

            if (parsed.relatedSpots || parsed.recommendedRoutes || parsed.suggestions || parsed.sources) {
              guideResult = normalizeGuideChatResult({
                sessionId: nextSessionId,
                traceId: parsed.traceId,
                relatedSpots: parsed.relatedSpots,
                recommendedRoutes: parsed.recommendedRoutes,
                suggestions: parsed.suggestions,
                sources: parsed.sources,
              })
              setMessages((current) => current.map((msg) => (
                msg.id === assistantMsgId ? { ...msg, result: guideResult } : msg
              )))
            }

            if (Number.isSafeInteger(parsed.messageId)) {
              guideResult = normalizeGuideChatResult({ ...guideResult, messageId: parsed.messageId })
              setMessages((current) => current.map((msg) => (
                msg.id === assistantMsgId ? { ...msg, messageId: parsed.messageId, result: guideResult } : msg
              )))
            }

            // token 事件：逐字输出
            if (parsed.token) {
              fullAnswer += parsed.token
              if (isCurrentRequest()) {
                const currentText = sanitizeAnswerText(fullAnswer) || '...'
                setMessages((current) =>
                  current.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, content: currentText } : msg
                  )
                )
                queueAnswerSpeech()
              }
            }

            // error 事件
            if (parsed.error) {
              console.error('[stream] error:', parsed.error)
              streamError = String(parsed.error)
              setStatus(streamError)
              if (!parsed.token) {
                enqueueCurrentSpeechSegments([streamError])
              }
              setMessages((current) =>
                current.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: sanitizeAnswerText(streamError), status: 'failed' as const }
                    : msg
                )
              )
            }
          } catch {
            console.warn('[stream] JSON 解析失败:', dataStr)
          }
        }
      }

      if (!isCurrentRequest()) {
        return
      }
      queueAnswerSpeech(true)
      const streamOutcome = resolveStreamOutcome({ streamError, fullAnswer })
      speechOutcomeRef.current = streamOutcome

      if (!fullAnswer.trim()) {
        const fallbackMessage = streamOutcome.status
        setStatus(fallbackMessage)
        enqueueCurrentSpeechSegments([fallbackMessage])
        setMessages((current) =>
          current.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: sanitizeAnswerText(fallbackMessage), status: 'failed' as const }
              : msg
          )
        )
        isAnswerStreamingRef.current = false
        setRuntimeState('error')
        setMobileLiveAnnouncement('灵灵回复失败，请稍后重试。')
        void playNextSpeechSegment(requestRunId)
        return
      }

      setStatus(streamOutcome.status)
      setRuntimeState(streamOutcome.state === 'error' ? 'error' : 'thinking')
      void triggerConfiguredAction({ text: `${question}\n${fullAnswer}` })
      isAnswerStreamingRef.current = false
      setMobileLiveAnnouncement(streamOutcome.state === 'error' ? '灵灵回复失败，请稍后重试。' : '灵灵的回复已完成。')
      guideResult = { ...guideResult, answerText: fullAnswer }
      setMessages((current) => current.map((msg) => (
        msg.id === assistantMsgId ? { ...msg, result: guideResult } : msg
      )))
      void playNextSpeechSegment(requestRunId)
    } catch (error) {
      console.error(error)
      if (!isCurrentRequest()) {
        return
      }
      isAnswerStreamingRef.current = false
      setStatus('导览请求失败，请确认问答服务和 TTS 服务已启动。')
      setRuntimeState('error')
      setMobileLiveAnnouncement('灵灵回复失败，请稍后重试。')
      speechOutcomeRef.current = {
        state: 'error',
        status: '导览请求失败，请确认问答服务和 TTS 服务已启动。',
      }
      enqueueCurrentSpeechSegments(['这次导览请求失败了，请稍后再试。'])
      setMessages((current) =>
        current.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: '这次导览请求失败了，请稍后再试。', status: 'failed' as const }
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
    setStatus(`正在切换数字人：${model.name}`)
  }

  return (
    <main className="module-screen">

      <section ref={livePageRef} className="live2d-page live2d-page--presentation">
        <canvas ref={canvasRef} className="live2d-canvas" />
        <div className="digital-human-stage-glow" aria-hidden />
        <div className="digital-human-status" data-runtime-state={runtimeState} aria-live="polite">
          <span className={isReady ? 'digital-human-status__dot digital-human-status__dot--ready' : 'digital-human-status__dot'} />
          <span>{status}</span>
        </div>

        <section className="digital-human-mobile-live" aria-label="灵山数字人直播导览">
          <button
            ref={settingsTriggerRef}
            className="digital-mobile-settings-trigger"
            type="button"
            onClick={() => setMobileSettingsOpen(true)}
            aria-label="打开数字人设置"
          >
            设置
          </button>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {mobileLiveAnnouncement}
          </span>
          <section className="digital-mobile-comment-feed" aria-label="最近对话">
            {mobileLiveComments.map((message, index) => (
              <article
                key={message.id}
                className={`digital-mobile-comment digital-mobile-comment--${message.sender}`}
                data-mobile-hidden-on-short={shouldHideMobileLiveCommentOnShortViewport(mobileLiveComments.length, index)}
              >
                <strong>{message.sender === 'guide' ? '灵灵' : '我'}</strong>
                <span>{message.content}</span>
                {message.result ? (
                  <button
                    type="button"
                    onClick={(event) => openMobileHistory(message.id, event.currentTarget)}
                  >
                    查看推荐
                  </button>
                ) : null}
              </article>
            ))}
            <button
              className="digital-mobile-comment-feed__open"
              type="button"
              onClick={(event) => openMobileHistory(undefined, event.currentTarget)}
            >
              查看全部
            </button>
          </section>
          <div className="digital-mobile-quick-questions" aria-label="快捷提问">
            {MOBILE_LIVE_QUICK_QUESTIONS.map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={!isReady}
                data-question={item.question}
                onClick={handleMobileQuickQuestion}
              >
                {item.label}
              </button>
            ))}
          </div>
          <form className="digital-mobile-composer" onSubmit={handleSend}>
            <textarea
              value={draft}
              placeholder="问问灵灵…"
              rows={1}
              disabled={!isReady}
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
              onClick={startVoiceQuestion}
              disabled={!isReady || isSpeaking}
              aria-label="语音提问"
            >
              语音
            </button>
            <button type="submit" disabled={!canSend}>发送</button>
          </form>
        </section>

        {isMobileHistoryOpen ? (
          <div
            className="digital-mobile-sheet"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) closeMobileHistory()
            }}
          >
            <section
              ref={historyPanelRef}
              className="digital-mobile-sheet__panel digital-mobile-history"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-history-title"
            >
              <header className="digital-mobile-sheet__header">
                <div>
                  <h2 id="mobile-history-title">完整对话</h2>
                  <span>{messages.length} 条消息</span>
                </div>
                <button type="button" onClick={closeMobileHistory} aria-label="关闭完整对话">关闭</button>
              </header>
              <div className="digital-mobile-history__body">
                {messages.map((message) => (
                  <div id={`mobile-history-${message.id}`} key={message.id}>
                    <DigitalChatMessageArticle
                      message={message}
                      onSuggestion={(suggestion) => {
                        setDraft(suggestion)
                        closeMobileHistory()
                        void sendQuestion(suggestion)
                      }}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {isMobileSettingsOpen ? (
          <div
            className="digital-mobile-sheet"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) closeMobileSettings()
            }}
          >
            <section
              ref={settingsPanelRef}
              className="digital-mobile-sheet__panel digital-mobile-settings"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-settings-title"
            >
              <header className="digital-mobile-sheet__header">
                <h2 id="mobile-settings-title">数字人设置</h2>
                <button type="button" onClick={closeMobileSettings} aria-label="关闭数字人设置">关闭</button>
              </header>
              <div className="digital-mobile-settings__body">
                <fieldset>
                  <legend>服务来源</legend>
                  {FACTORY_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={item.id === selectedFactory.id}
                      disabled={isSpeaking}
                      onClick={() => handleSelectFactory(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>播报音色</legend>
                  {VOICE_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={item.id === selectedVoice.id}
                      disabled={isSpeaking}
                      onClick={() => handleSelectVoice(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>数字人模型</legend>
                  {MODEL_OPTIONS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={item.id === selectedModel.id}
                      disabled={isSpeaking}
                      onClick={() => handleSelectModel(item.id)}
                    >
                      {item.name}
                    </button>
                  ))}
                </fieldset>
              </div>
            </section>
          </div>
        ) : null}

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
            {messages.map((message) => (
              <DigitalChatMessageArticle
                key={message.id}
                message={message}
                onSuggestion={(suggestion) => {
                  setDraft(suggestion)
                  void sendQuestion(suggestion)
                }}
              />
            ))}
            <div ref={messagesEndRef} />
          </main>

          <footer className="digital-chat-composer">
            <form className="digital-chat-form" onSubmit={handleSend}>
              <textarea
                value={draft}
                placeholder="请输入您的问题..."
                rows={2}
                disabled={!isReady}
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
                发送
              </button>
            </form>
          </footer>
        </aside>
      </section>
    </main>
  )
}
