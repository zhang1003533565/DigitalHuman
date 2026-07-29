import axios from 'axios'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getFacilityLiveConfig, type FacilityLiveConfig } from '../api/liveBroadcast'
import { getStoredUser } from '../auth/session'
import {
  createTtsPayload,
  LIVE2D_MODEL_LOAD_OPTIONS,
  loadLive2dScripts,
  MODEL_OPTIONS,
  resolveLive2dAssetUrl,
  TTS_ENDPOINT,
  speak,
  stopSpeech,
  type Live2DModel,
  type PixiApplication,
} from '../digitalHuman/shared'
import { createNarrationController, type FacilityNarrationController } from '../live/facilityNarrationController'
import { appendLiveMessage, updateLiveMessage, type LiveChatMessage } from '../live/liveChat'
import { parseLiveGuideStreamData } from '../live/liveBroadcastRuntime'
import { disposeLive2dResources, releaseLive2dRefs } from '../live/live2dCleanup'
import { resolveLive2dStageLayout } from '../live/live2dStageLayout'
import { LiveChatFeed } from './components/LiveChatFeed'
import './LiveBroadcastPage.css'

type LivePhase = 'syncing' | 'narrating' | 'asking' | 'answering' | 'resume-wait' | 'unavailable' | 'error'

const LIVE_GUIDE_SESSION_KEY_PREFIX = 'digitalhuman.visitor.liveGuide.'
const SSE_CHUNK_SIZE = 20 // emit UI update every N chars to avoid excessive re-renders

// ----- Live-show HUD: floating reactions (real user actions) -----
type ReactionItem = {
  id: number
  emoji: string
  left: number // percent
  driftX: number // px
  bornAt: number
}
type SelfDanmakuItem = {
  id: number
  text: string
  top: number // percent
  duration: number // seconds
  bornAt: number
}

const REACTION_EMOJIS = ['❤️', '👍', '🌸', '✨', '🎉', '💖', '👏']

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getFollowStorageKey(facilityId: number | null) {
  return facilityId === null ? null : `digitalhuman.visitor.follow.${facilityId}`
}

function loadFollowState(facilityId: number | null): boolean {
  if (facilityId === null) return false
  try {
    return window.localStorage.getItem(getFollowStorageKey(facilityId)!) === '1'
  } catch {
    return false
  }
}

function saveFollowState(facilityId: number | null, following: boolean) {
  const key = getFollowStorageKey(facilityId)
  if (!key) return
  try {
    if (following) window.localStorage.setItem(key, '1')
    else window.localStorage.removeItem(key)
  } catch {
    /* quota / disabled storage */
  }
}

// Per-visitor, per-facility "I pressed the like button N times" counter.
// Stored locally so the number persists across reloads — no server required.
function getLikeStorageKey(facilityId: number | null) {
  return facilityId === null ? null : `digitalhuman.visitor.likes.${facilityId}`
}

function loadLikeCount(facilityId: number | null): number {
  const key = getLikeStorageKey(facilityId)
  if (!key) return 0
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return 0
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

function saveLikeCount(facilityId: number | null, count: number) {
  const key = getLikeStorageKey(facilityId)
  if (!key) return
  try {
    window.localStorage.setItem(key, String(count))
  } catch {
    /* quota / disabled storage */
  }
}

function resolveConfiguredModelUrl(modelPath: string) {
  const normalized = modelPath.trim().replaceAll('\\', '/').replace(/^\/+/, '')
  const publicPath = normalized.startsWith('live2d/') ? `/${normalized}` : `/live2d/${normalized}`
  return resolveLive2dAssetUrl(publicPath)
}

function getUnavailableMessage(config: FacilityLiveConfig) {
  if (config.unavailableReason === 'LIVE_DISABLED') return `${config.facilityName}尚未开启直播`
  if (config.unavailableReason === 'DIGITAL_HUMAN_UNAVAILABLE') return `${config.facilityName}尚未绑定可用的直播数字人`
  return `${config.facilityName}直播配置暂不可用`
}

function sessionKey(facilityId: number) {
  return `${LIVE_GUIDE_SESSION_KEY_PREFIX}${facilityId}`
}

function loadSessionId(facilityId: number): string | undefined {
  try { return sessionStorage.getItem(sessionKey(facilityId)) ?? undefined } catch { return undefined }
}

function saveSessionId(facilityId: number, sessionId: string) {
  try { sessionStorage.setItem(sessionKey(facilityId), sessionId) } catch { /* quota exceeded */ }
}

function createMessageId(prefix: LiveChatMessage['role']) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pruneOldSessions(currentFacilityId: number) {
  try {
    const prefix = LIVE_GUIDE_SESSION_KEY_PREFIX
    const cutoff = Date.now() - 30 * 60 * 1000 // 30 minutes
    const keysToRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(prefix) && key !== sessionKey(currentFacilityId)) {
        const raw = sessionStorage.getItem(key)
        if (raw) {
          try {
            const entry = JSON.parse(raw) as { savedAt: number }
            if (entry.savedAt < cutoff) keysToRemove.push(key)
          } catch { keysToRemove.push(key) }
        }
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k))
  } catch { /* security policy or quota */ }
}

function reportLive2dCleanupError(step: string, error: unknown) {
  console.debug(`[live2d-cleanup:${step}]`, error)
}

export function LiveBroadcastPage() {
  const [searchParams] = useSearchParams()
  const spotIdParam = searchParams.get('spotId')
  const facilityId = spotIdParam && /^\d+$/.test(spotIdParam) ? Number(spotIdParam) : null
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const pixiRef = useRef<PixiApplication | null>(null)
  const playbackRequestRef = useRef<AbortController | null>(null)
  const interactionRequestRef = useRef<AbortController | null>(null)
  const resumeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCleanupRef = useRef<(() => void) | null>(null)
  const narrationControllerRef = useRef<FacilityNarrationController | null>(null)
  const mountedRef = useRef(false)
  const [phase, setPhase] = useState<LivePhase>('syncing')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<LiveChatMessage[]>([])
  const [interactionError, setInteractionError] = useState('')
  const [broadcastSpeechError, setBroadcastSpeechError] = useState('')
  const [liveConfig, setLiveConfig] = useState<FacilityLiveConfig | null>(null)
  const [liveConfigError, setLiveConfigError] = useState('')
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [modelReady, setModelReady] = useState(false)
  const [narrationUnlockUrl, setNarrationUnlockUrl] = useState('')
  const [narrationUnlockMessageId, setNarrationUnlockMessageId] = useState('')

  // ----- Live-show HUD state (only real signals from this visitor) -----
  const [following, setFollowing] = useState<boolean>(() => loadFollowState(facilityId))
  const [likesDelta, setLikesDelta] = useState<number>(0)
  // Derived so we don't have to mirror a stored value into state in an effect.
  const storedLikes = loadLikeCount(facilityId)
  const likes = storedLikes + likesDelta
  const [reactions, setReactions] = useState<ReactionItem[]>([])
  const [selfDanmaku, setSelfDanmaku] = useState<SelfDanmakuItem[]>([])
  const reactionIdRef = useRef(0)
  const stageSectionRef = useRef<HTMLElement | null>(null)
  const stageCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const handledDanmakuIdsRef = useRef<Set<string>>(new Set())

  // Persist follow state across reloads / facility switches
  useEffect(() => {
    saveFollowState(facilityId, following)
  }, [following, facilityId])

  // Reset the in-memory likesDelta whenever we render with a different facility
  // than the one we last captured. Comparing during render (rather than inside an
  // effect) avoids the cascading setState that React 19's set-state-in-effect
  // rule flags, while still achieving the "spot keeps its own cumulative number"
  // semantics that the original useEffect provided.
  const [lastFacilityForLikes, setLastFacilityForLikes] = useState(facilityId)
  if (lastFacilityForLikes !== facilityId) {
    setLastFacilityForLikes(facilityId)
    setLikesDelta(0)
  }

  // Persist the like count whenever it changes
  useEffect(() => {
    saveLikeCount(facilityId, likes)
  }, [likes, facilityId])
  const liveConfigErrorMessage = facilityId
    ? liveConfigError
    : '缺少有效的景点编号，无法确定直播数字人。'

  const clearResumeTimer = useCallback(() => {
    if (resumeTimerRef.current !== null) {
      window.clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }, [])

  const stopPlayback = useCallback(() => {
    playbackRequestRef.current?.abort()
    playbackRequestRef.current = null
    audioCleanupRef.current?.()
    audioCleanupRef.current = null
    const model = modelRef.current
    if (model) {
      try {
        stopSpeech(model)
      } catch (error) {
        reportLive2dCleanupError('stop-playback', error)
      }
    }
  }, [])

  const playAudioUrl = useCallback(async (audioUrl: string, signal: AbortSignal) => {
    const model = modelRef.current
    if (model) {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const settle = (error?: Error) => {
          if (settled) return
          settled = true
          signal.removeEventListener('abort', handleAbort)
          try {
            stopSpeech(model)
          } catch (error) {
            reportLive2dCleanupError('settle-playback', error)
          }
          if (audioCleanupRef.current === handleAbort) audioCleanupRef.current = null
          if (error) reject(error); else resolve()
        }
        const handleAbort = () => settle(new DOMException('播放已取消', 'AbortError'))
        audioCleanupRef.current = handleAbort
        signal.addEventListener('abort', handleAbort, { once: true })
        speak(model, audioUrl, { onFinish: () => settle(), onError: (error) => settle(error) })
      })
      return
    }

    const audio = new Audio(audioUrl)
    audioRef.current = audio
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        audio.removeEventListener('ended', handleEnded)
        audio.removeEventListener('error', handleError)
        signal.removeEventListener('abort', handleAbort)
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        if (audioRef.current === audio) audioRef.current = null
      }
      const settle = (error?: Error) => {
        if (settled) return
        settled = true
        cleanup()
        if (audioCleanupRef.current === abortPlayback) audioCleanupRef.current = null
        if (error) reject(error); else resolve()
      }
      const handleEnded = () => settle()
      const handleError = () => settle(new Error('语音播放失败'))
      const handleAbort = () => settle(new DOMException('播放已取消', 'AbortError'))
      const abortPlayback = () => handleAbort()
      audioCleanupRef.current = abortPlayback
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('error', handleError)
      signal.addEventListener('abort', handleAbort, { once: true })
      void audio.play().catch((error) => settle(error instanceof Error ? error : new Error(String(error))))
    })
  }, [])

  const speakAudio = useCallback(async (audioUrl: string) => {
    stopPlayback()
    const controller = new AbortController()
    playbackRequestRef.current = controller
    try {
      await playAudioUrl(audioUrl, controller.signal)
    } finally {
      if (playbackRequestRef.current === controller) playbackRequestRef.current = null
    }
  }, [playAudioUrl, stopPlayback])

  const playText = useCallback(async (text: string, signal: AbortSignal) => {
    const response = await axios.post(TTS_ENDPOINT, createTtsPayload(text), { responseType: 'blob', signal })
    if (signal.aborted) return
    const audioUrl = URL.createObjectURL(response.data)
    try {
      await playAudioUrl(audioUrl, signal)
    } finally {
      URL.revokeObjectURL(audioUrl)
    }
  }, [playAudioUrl])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    if (!facilityId) {
      void Promise.resolve().then(() => {
        if (!controller.signal.aborted) setPhase('unavailable')
      })
      return () => controller.abort()
    }
    void Promise.resolve()
      .then(() => {
        if (controller.signal.aborted) return null
        narrationControllerRef.current?.destroy()
        narrationControllerRef.current = null
        interactionRequestRef.current?.abort()
        clearResumeTimer()
        stopPlayback()
        setLiveConfig(null)
        setLiveConfigError('')
        setMediaReady(false)
        setMediaError('')
        setModelReady(false)
        setNarrationUnlockUrl('')
        setNarrationUnlockMessageId('')
        setMessages([])
        setPhase('syncing')
        if (facilityId) pruneOldSessions(facilityId)
        return getFacilityLiveConfig(facilityId, { signal: controller.signal })
      })
      .then((config) => {
        if (controller.signal.aborted || !config) return
        setLiveConfig(config)
        if (!config.available || !config.digitalHuman?.modelPath) {
          setLiveConfigError(getUnavailableMessage(config))
          setPhase('unavailable')
          return
        }
        if (!config.narration?.audioUrl) {
          setMessages((previous) => appendLiveMessage(previous, {
            id: createMessageId('system'),
            role: 'system',
            nickname: '系统',
            content: '尚未配置循环讲解，仍可观看视频并向数字人提问。',
            createdAt: Date.now(),
            status: 'sent',
          }))
          setPhase('unavailable')
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return
        setLiveConfigError(error instanceof Error ? `直播配置加载失败：${error.message}` : '直播配置加载失败')
        setPhase('error')
      })
    return () => controller.abort()
  }, [clearResumeTimer, facilityId, stopPlayback])

  useEffect(() => {
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    const canvas = canvasRef.current
    const digitalHuman = liveConfig?.available ? liveConfig.digitalHuman : null
    if (!canvas || !digitalHuman?.modelPath) return
    setModelReady(false)
    void loadLive2dScripts().then(async () => {
      if (cancelled || !window.PIXI) return
      const app = new window.PIXI.Application({ view: canvas, autoStart: true, resizeTo: canvas.parentElement ?? window, backgroundAlpha: 0 })
      const model = await window.PIXI.live2d.Live2DModel.from(
        resolveConfiguredModelUrl(digitalHuman.modelPath),
        LIVE2D_MODEL_LOAD_OPTIONS,
      )
      if (cancelled) {
        disposeLive2dResources({ model, app, stopSpeech, onError: reportLive2dCleanupError })
        return
      }
      const modelDisplay = MODEL_OPTIONS.find((option) => option.id === digitalHuman.modelKey)
      const modelWidth = model.width
      const modelHeight = model.height
      const applyModelLayout = () => {
        const layout = resolveLive2dStageLayout({
          stageWidth: canvas.clientWidth,
          stageHeight: canvas.clientHeight,
          modelWidth,
          modelHeight,
          scaleMultiplier: modelDisplay?.scaleMultiplier,
          xOffsetRatio: modelDisplay?.xOffsetRatio,
          yOffsetRatio: modelDisplay?.yOffsetRatio,
        })
        model.scale.set(layout.scale)
        model.position.x = layout.x
        model.position.y = layout.y
      }
      applyModelLayout()
      app.stage.addChild(model)
      resizeObserver = new ResizeObserver(applyModelLayout)
      resizeObserver.observe(canvas)
      pixiRef.current = app
      modelRef.current = model
      setModelReady(true)
    }).catch(() => {
      if (!cancelled) {
        setBroadcastSpeechError('数字人舞台加载失败，直播字幕仍可继续观看。')
        setModelReady(true)
      }
    })
    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      setModelReady(false)
      releaseLive2dRefs({
        modelRef,
        appRef: pixiRef,
        stopSpeech,
        onError: reportLive2dCleanupError,
      })
    }
  }, [liveConfig])

  useEffect(() => {
    narrationControllerRef.current?.destroy()
    narrationControllerRef.current = null
    if (!liveConfig?.available || !liveConfig.digitalHuman || !modelReady) return
    if (!liveConfig.narration?.audioUrl) return
    const narrationAudioUrl = liveConfig.narration.audioUrl
    const controller = createNarrationController({
      speakAudio,
      stopAudio: stopPlayback,
      delayMs: 2000,
      onError: (error) => {
        const messageId = createMessageId('system')
        setNarrationUnlockUrl(narrationAudioUrl)
        setNarrationUnlockMessageId(messageId)
        setBroadcastSpeechError(`循环讲解播放失败：${error.message}`)
        setMessages((previous) => appendLiveMessage(previous, {
          id: messageId,
          role: 'system',
          nickname: '系统',
          content: '浏览器阻止了自动讲解，点击开启讲解后会继续播放。',
          createdAt: Date.now(),
          status: 'sent',
        }))
      },
    })
    narrationControllerRef.current = controller
    const startTimer = window.setTimeout(() => {
      if (narrationControllerRef.current !== controller) return
      setPhase('narrating')
      setBroadcastSpeechError('')
      narrationControllerRef.current?.start(narrationAudioUrl)
    }, 0)
    return () => {
      window.clearTimeout(startTimer)
      controller.destroy()
      if (narrationControllerRef.current === controller) narrationControllerRef.current = null
    }
  }, [liveConfig, modelReady, speakAudio, stopPlayback])

  // Spawn a reaction (heart / emoji) on like-button click — real user input only.
  // Also increments this visitor's persistent like counter for the current facility.
  const spawnReaction = useCallback(() => {
    if (facilityId === null) return
    setLikesDelta((previous) => previous + 1)
    const burst = 1 + Math.floor(Math.random() * 2)
    for (let i = 0; i < burst; i++) {
      const item: ReactionItem = {
        id: ++reactionIdRef.current,
        emoji: pickRandom(REACTION_EMOJIS),
        left: 18 + Math.random() * 28,
        driftX: (Math.random() - 0.5) * 90,
        bornAt: performance.now(),
      }
      setReactions((prev) => [...prev, item])
      window.setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== item.id))
      }, 3200)
    }
  }, [facilityId])

// When this visitor submits a question, immediately surface it as a
  // floating danmaku on the stage. Trigger on 'sending' (not waiting for
  // the server's 'sent') so the user gets instant visual feedback.
  useEffect(() => {
    // Look at all viewer messages and find any we haven't danmaku'd yet.
    const handled = handledDanmakuIdsRef.current
    const unhandled = messages.filter(
      (m) => m.role === 'viewer' &&
             (m.status === 'sending' || m.status === 'sent' || m.status === 'failed') &&
             !handled.has(m.id),
    )
    if (unhandled.length === 0) return
    for (const viewerMsg of unhandled) {
      handled.add(viewerMsg.id)
      const item: SelfDanmakuItem = {
        id: ++reactionIdRef.current,
        text: viewerMsg.content,
        top: 8 + Math.random() * 50, // 8%..58% (avoid HUD / subtitle)
        duration: 9 + Math.random() * 4,
        bornAt: performance.now(),
      }
      setSelfDanmaku((prev) => [...prev, item])
      window.setTimeout(() => {
        setSelfDanmaku((prev) => prev.filter((d) => d.id !== item.id))
      }, item.duration * 1000 + 200)
    }
  }, [messages])

  // Cleanup any timers if component fully unmounts
  useEffect(() => () => {
    narrationControllerRef.current?.destroy()
    narrationControllerRef.current = null
    interactionRequestRef.current?.abort()
    interactionRequestRef.current = null
    clearResumeTimer()
    stopPlayback()
  }, [clearResumeTimer, stopPlayback])

  // ----- Audio visualizer (when digital human is speaking) -----
  useEffect(() => {
    const isSpeaking = phase === 'narrating' || phase === 'answering'
    if (!isSpeaking) return
    const audio = audioRef.current
    if (!audio) return
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx()
      const ctx = audioCtxRef.current!
      if (ctx.state === 'suspended') void ctx.resume()
      if (!mediaSourceRef.current || mediaSourceRef.current.mediaElement !== audio) {
        if (mediaSourceRef.current) {
          try { mediaSourceRef.current.disconnect() } catch { /* already torn down */ }
        }
        mediaSourceRef.current = ctx.createMediaElementSource(audio)
      }
      if (!analyserRef.current) analyserRef.current = ctx.createAnalyser()
      analyserRef.current.fftSize = 64
      mediaSourceRef.current.connect(analyserRef.current)
      analyserRef.current.connect(ctx.destination)
    } catch { /* visualizer is non-critical */ }
    return () => {
      try { mediaSourceRef.current?.disconnect() } catch { /* ignore */ }
      try { analyserRef.current?.disconnect() } catch { /* ignore */ }
    }
  }, [phase])

  // RAF loop that paints the waveform when speaking
  useEffect(() => {
    const isSpeaking = phase === 'narrating' || phase === 'answering'
    if (!isSpeaking) return
    const canvas = stageCanvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const buffer = new Uint8Array(analyser.frequencyBinCount)
    const dpr = Math.min(2, window.devicePixelRatio || 1)

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const draw = () => {
      analyser.getByteFrequencyData(buffer)
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      ctx2d.clearRect(0, 0, w, h)
      const bars = 24
      const step = w / bars
      const max = Math.max(...buffer) || 1
      for (let i = 0; i < bars; i++) {
        const v = buffer[Math.floor((i / bars) * buffer.length)] / max
        const barH = Math.max(4, v * h * 0.95)
        const x = i * step + step * 0.18
        const y = (h - barH) / 2
        const grad = ctx2d.createLinearGradient(0, y, 0, y + barH)
        grad.addColorStop(0, 'rgba(56,189,248,0.95)')
        grad.addColorStop(1, 'rgba(168,85,247,0.85)')
        ctx2d.fillStyle = grad
        const radius = Math.min(step * 0.32, 6)
        const bw = step * 0.64
        ctx2d.beginPath()
        ctx2d.moveTo(x + radius, y)
        ctx2d.lineTo(x + bw - radius, y)
        ctx2d.quadraticCurveTo(x + bw, y, x + bw, y + radius)
        ctx2d.lineTo(x + bw, y + barH - radius)
        ctx2d.quadraticCurveTo(x + bw, y + barH, x + bw - radius, y + barH)
        ctx2d.lineTo(x + radius, y + barH)
        ctx2d.quadraticCurveTo(x, y + barH, x, y + barH - radius)
        ctx2d.lineTo(x, y + radius)
        ctx2d.quadraticCurveTo(x, y, x + radius, y)
        ctx2d.fill()
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [phase])

  // Pause audio when page goes to background; resume when it returns
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (phase === 'narrating') narrationControllerRef.current?.interrupt()
      } else {
        if (phase === 'narrating' && liveConfig?.narration?.audioUrl) {
          narrationControllerRef.current?.resume()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [phase, liveConfig?.narration?.audioUrl])

  async function askQuestion(event: FormEvent, retryContent?: string) {
    event.preventDefault()
    const question = (retryContent ?? draft).trim()
    if (!question) return

    narrationControllerRef.current?.interrupt()
    interactionRequestRef.current?.abort()
    clearResumeTimer()
    setPhase('asking')
    if (!retryContent) setDraft('')
    setInteractionError('')
    setBroadcastSpeechError('')

    const now = Date.now()
    const viewerMessage: LiveChatMessage = {
      id: createMessageId('viewer'),
      role: 'viewer',
      nickname: '我',
      content: question,
      createdAt: now,
      status: 'sending',
    }
    const hostMessage: LiveChatMessage = {
      id: createMessageId('host'),
      role: 'host',
      nickname: liveConfig?.digitalHuman?.displayName ?? '数字人主播',
      content: '',
      createdAt: now + 1,
      status: 'streaming',
    }
    setMessages((previous) => appendLiveMessage(appendLiveMessage(previous, viewerMessage), hostMessage))

    const controller = new AbortController()
    interactionRequestRef.current = controller
    let fullAnswer = ''
    try {
      let retryCount = 0
      const maxRetries = 2
      let response: Response | null = null
      while (retryCount <= maxRetries) {
        const user = getStoredUser()
        response = await fetch('/api/user/guide/chat/stream', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
          },
          body: JSON.stringify({ sessionId: facilityId ? loadSessionId(facilityId) : undefined, question }),
        }).catch((networkError) => {
          throw Object.assign(new Error('网络连接失败，请检查网络后重试'), { isNetworkError: true, cause: networkError })
        })
        if (response.ok) break
        const status = response.status
        if (status === 429 || status >= 500) {
          retryCount++
          if (retryCount <= maxRetries) {
            const delay = Math.pow(2, retryCount) * 800
            await new Promise<void>((resolve) => { resumeTimerRef.current = window.setTimeout(resolve, delay) })
            if (controller.signal.aborted) throw new DOMException('aborted', 'AbortError')
            continue
          }
        }
        const contentType = response.headers.get('content-type') ?? ''
        if (contentType.includes('application/json')) {
          try {
            const errBody = await response.clone().json() as { message?: string }
            throw new Error(errBody.message ?? `服务错误 (${status})`)
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) {
              throw new Error(`请求失败 (${status})`, { cause: parseErr })
            }
            throw parseErr
          }
        }
        if (status === 401 || status === 403) throw new Error('登录状态已失效，请重新登录后重试。')
        if (status === 503) throw new Error('服务暂时不可用，请稍后重试。')
        throw new Error(`个人问答服务暂时不可用 (${status})`)
      }
      if (response === null) throw new Error('个人问答服务暂时不可用')
      const streamingResponse = response
      if (!streamingResponse.ok || !streamingResponse.body) throw new Error('个人问答服务暂时不可用')
      setMessages((previous) => updateLiveMessage(previous, viewerMessage.id, { status: 'sent' }))
      setPhase('answering')
      const reader = streamingResponse.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const raw = line.slice(5).trim(); if (!raw || raw === '[DONE]') continue
          try {
            const data = parseLiveGuideStreamData(raw)
            if (!data) continue
            if (data.sessionId && facilityId) saveSessionId(facilityId, data.sessionId)
            if (data.token) {
              const prevLen = fullAnswer.length
              fullAnswer += data.token
              if (fullAnswer.length - prevLen >= SSE_CHUNK_SIZE || fullAnswer.length % 80 < SSE_CHUNK_SIZE) {
                setMessages((previous) => updateLiveMessage(previous, hostMessage.id, { content: fullAnswer, status: 'streaming' }))
              }
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
      }
      // Drain any remaining buffered tokens
      if (buffer.trim() && !buffer.startsWith('data:')) {
        // No complete SSE line pending; ignore fragment
      }
      if (!fullAnswer.trim()) throw new Error('个人问答没有返回有效内容')
      setMessages((previous) => updateLiveMessage(previous, hostMessage.id, { content: fullAnswer, status: 'sent' }))
      try {
        await playText(fullAnswer, controller.signal)
      } catch (speechError) {
        if (!controller.signal.aborted) setInteractionError(speechError instanceof Error ? `回答已生成，但${speechError.message}` : '回答语音播放失败')
      }
    } catch (askError) {
      if (controller.signal.aborted) return
      const message = askError instanceof Error ? askError.message : '提问失败'
      setInteractionError(message)
      setMessages((previous) => updateLiveMessage(
        updateLiveMessage(previous, viewerMessage.id, { status: 'failed' }),
        hostMessage.id,
        { content: message, status: 'failed' },
      ))
    } finally {
      if (interactionRequestRef.current === controller) interactionRequestRef.current = null
      if (!controller.signal.aborted && mountedRef.current) {
        clearResumeTimer()
        if (liveConfig?.narration?.audioUrl) {
          setPhase('resume-wait')
          resumeTimerRef.current = window.setTimeout(() => {
            resumeTimerRef.current = null
            narrationControllerRef.current?.resume()
            setPhase('narrating')
          }, 300)
        } else {
          setPhase('unavailable')
        }
      }
    }
  }

  const retryQuestion = (message: LiveChatMessage) => {
    void askQuestion({ preventDefault() {} } as FormEvent, message.content)
  }

  const unlockNarration = useCallback(() => {
    const audioUrl = narrationUnlockUrl || liveConfig?.narration?.audioUrl
    if (!audioUrl) return
    setNarrationUnlockUrl('')
    setNarrationUnlockMessageId('')
    setBroadcastSpeechError('')
    setPhase('narrating')
    narrationControllerRef.current?.start(audioUrl)
  }, [liveConfig?.narration?.audioUrl, narrationUnlockUrl])

  const isLiveAvailable = Boolean(liveConfig?.available && liveConfig.digitalHuman)
  const isVideoSource = liveConfig?.liveSourceType === 'video' && Boolean(liveConfig.liveVideoUrl)
  const isInteractionBusy = !isLiveAvailable || ['syncing', 'asking', 'answering'].includes(phase)
  const latestHostMessage = [...messages].reverse().find((message) => message.role === 'host' && message.content)

  return <div className="live-broadcast-page">
    <main className="live-broadcast-page__body">
      <div className="live-stage-column">
        <header className="live-hud" aria-label="直播间信息">
          <div className="live-hud__title" title={liveConfig?.digitalHuman?.displayName ?? '数字人主播'}>
            <span className="live-hud__live-dot" aria-hidden="true" />
            <span className="live-hud__live-label">LIVE</span>
            <span className="live-hud__divider" aria-hidden="true" />
            <span className="live-hud__host-name">{liveConfig?.digitalHuman?.displayName ?? '数字人主播'}</span>
          </div>
          <button
            type="button"
            className={`live-hud__follow${following ? ' live-hud__follow--on' : ''}`}
            onClick={() => setFollowing((f) => !f)}
            aria-pressed={following}
            disabled={facilityId === null}
          >
            <span aria-hidden="true">{following ? '✓' : '+'}</span>
            {following ? '已关注' : '关注主播'}
          </button>
        </header>
      <section
        ref={stageSectionRef}
        className={`live-stage${mediaReady || phase === 'narrating' ? ' live-stage--active' : ''}`}
        aria-label="数字人直播舞台"
      >
        <div className="live-stage__scanline" aria-hidden="true" />
        {isVideoSource ? (
          <video
            className="live-stage__media"
            src={liveConfig.liveVideoUrl ?? undefined}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="景点直播视频"
            onCanPlay={() => setMediaReady(true)}
            onPlaying={() => { setMediaReady(true); setMediaError('') }}
            onError={() => setMediaError('直播视频加载失败，请检查视频地址或重新上传。')}
          />
        ) : null}
        <canvas ref={canvasRef} className="live-stage__canvas" />
        {/* Audio waveform visualizer — sits behind subtitles, in front of canvas */}
        {(phase === 'narrating' || phase === 'answering') ? (
          <canvas
            ref={stageCanvasRef}
            className="live-stage__visualizer"
            aria-hidden="true"
          />
        ) : null}
        <div className={`live-stage__model-placeholder${modelReady || liveConfigErrorMessage || isVideoSource ? ' live-stage__model-placeholder--hidden' : ''}`} aria-hidden="true">
          <div className="live-stage__model-icon">&#x1F9D1;&#x200D;&#x2728;</div>
          <p>数字人加载中</p>
        </div>
        <div className="live-stage__badge" data-phase={phase}>{liveConfigErrorMessage ? '未配置' : mediaError ? '视频异常' : mediaReady ? '直播中' : phase === 'syncing' || phase === 'resume-wait' ? '重连中' : phase === 'error' ? '同步失败' : phase === 'narrating' ? '直播中' : '准备中'}</div>
        <div className={`live-stage__overlay ${phase === 'syncing' && !liveConfigErrorMessage ? 'live-stage__overlay--visible' : ''}`} aria-hidden="true">
          <div className="live-stage__sync-ring" />
          <p className="live-stage__sync-text">正在同步直播内容</p>
        </div>

        {/* Floating danmaku container — each entry is a real question
            this visitor just sent to the digital human. */}
        <div className="live-stage__danmaku" aria-hidden="true">
          {selfDanmaku.map((item) => (
            <span
              key={item.id}
              className="live-stage__danmaku-item live-stage__danmaku-item--self"
              style={{
                top: `${item.top}%`,
                animationDuration: `${item.duration}s`,
              }}
            >
              我：{item.text}
            </span>
          ))}
        </div>

        {/* Floating reactions (hearts / emojis) — only ever triggered by
            the user's own click on the like button. */}
        <div className="live-stage__reactions" aria-hidden="true">
          {reactions.map((r) => (
            <span
              key={r.id}
              className="live-stage__reaction"
              style={{
                left: `${r.left}%`,
                ['--drift' as string]: `${r.driftX}px`,
              }}
            >
              {r.emoji}
            </span>
          ))}
        </div>

        {/* Like button anchored to bottom-right of stage.
            Shows the visitor's own cumulative click count for this facility,
            persisted via localStorage. Hidden until the first click. */}
        <button
          type="button"
          className="live-stage__like"
          onClick={spawnReaction}
          aria-label={likes > 0 ? `已点赞 ${likes} 次` : '点赞'}
          title="点赞"
          disabled={facilityId === null}
        >
          <span className="live-stage__like-emoji" aria-hidden="true">❤</span>
          {likes > 0
            ? <span className="live-stage__like-count">{likes.toLocaleString()}</span>
            : <span className="live-stage__like-label">赞</span>}
        </button>

        <div className="live-stage__subtitle" aria-live="polite">
          <strong>{liveConfigErrorMessage ? '景点直播暂不可用' : mediaError ? '直播视频暂不可用' : liveConfig?.narration?.title ?? (mediaReady ? '景点视频直播中' : phase === 'unavailable' ? '直播内容准备中' : '正在同步直播')}</strong>
          <p>{liveConfigErrorMessage || mediaError || latestHostMessage?.content || interactionError || broadcastSpeechError || (liveConfig?.narration?.audioUrl ? (phase === 'narrating' ? '循环讲解播放中，向我提问会自动暂停讲解。' : phase === 'asking' || phase === 'answering' ? '正在思考你的问题…' : '讲解已暂停，可以向我提问。') : '直播内容准备中')}</p>
        </div>
      </section>
      </div>
      <aside className="live-interaction" aria-label="直播互动">
        <Link to="/map" className="live-interaction__back">← 返回地图</Link>
        <div className="live-interaction__head">
          <h1>{liveConfig?.digitalHuman ? `和${liveConfig.digitalHuman.displayName}聊一聊` : '和数字人聊一聊'}</h1>
          {liveConfig?.digitalHuman ? <p className="live-interaction__presenter">当前主播</p> : null}
        </div>
        <p className="live-interaction__hint">提问期间只会暂停你的本地直播语音，不影响其他游客。</p>
        {interactionError && <p className="live-interaction__error" role="alert">{interactionError}</p>}
        {broadcastSpeechError && <p className="live-interaction__speech-error" role="status">{broadcastSpeechError}</p>}
        {liveConfigErrorMessage && <p className="live-interaction__sync-error" role="status">{liveConfigErrorMessage}</p>}
        <LiveChatFeed
          messages={messages}
          draft={draft}
          busy={isInteractionBusy}
          disabled={!isLiveAvailable}
          presenterName={liveConfig?.digitalHuman?.displayName}
          type="text"
          aria-label="发送弹幕"
          placeholder="输入你想了解的问题"
          systemActionLabel={narrationUnlockUrl ? '开启讲解' : undefined}
          systemActionMessageId={narrationUnlockMessageId || undefined}
          onDraftChange={setDraft}
          onSend={askQuestion}
          onRetry={retryQuestion}
          onSystemAction={unlockNarration}
        />
      </aside>
    </main>
  </div>
}
