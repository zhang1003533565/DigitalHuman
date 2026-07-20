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

const LIVE_GUIDE_SESSION_KEY = 'digitalhuman.visitor.liveGuideSessionId'

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

function createMessageId(prefix: LiveChatMessage['role']) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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

  useEffect(() => () => {
    narrationControllerRef.current?.destroy()
    narrationControllerRef.current = null
    interactionRequestRef.current?.abort()
    interactionRequestRef.current = null
    clearResumeTimer()
    stopPlayback()
  }, [clearResumeTimer, stopPlayback])

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
      const user = getStoredUser()
      const response = await fetch('/api/user/guide/chat/stream', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ sessionId: window.sessionStorage.getItem(LIVE_GUIDE_SESSION_KEY) || undefined, question }),
      })
      if (!response.ok || !response.body) throw new Error('个人问答服务暂时不可用')
      setMessages((previous) => updateLiveMessage(previous, viewerMessage.id, { status: 'sent' }))
      setPhase('answering')
      const reader = response.body.getReader()
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
            if (data.sessionId) window.sessionStorage.setItem(LIVE_GUIDE_SESSION_KEY, data.sessionId)
            if (data.token) {
              fullAnswer += data.token
              setMessages((previous) => updateLiveMessage(previous, hostMessage.id, { content: fullAnswer, status: 'streaming' }))
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
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
      <section className="live-stage" aria-label="数字人直播舞台">
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
        <div className="live-stage__badge">{liveConfigErrorMessage ? '未配置' : mediaError ? '视频异常' : mediaReady ? '直播中' : phase === 'syncing' || phase === 'resume-wait' ? '重连中' : phase === 'error' ? '同步失败' : phase === 'narrating' ? '直播中' : '准备中'}</div>
        <div className="live-stage__subtitle" aria-live="polite">
          <strong>{liveConfigErrorMessage ? '景点直播暂不可用' : mediaError ? '直播视频暂不可用' : liveConfig?.narration?.title ?? (mediaReady ? '景点视频直播中' : phase === 'unavailable' ? '直播内容准备中' : '正在同步直播')}</strong>
          <p>{liveConfigErrorMessage || mediaError || latestHostMessage?.content || interactionError || broadcastSpeechError || (liveConfig?.narration?.audioUrl ? '循环讲解播放中，提问时会自动暂停。' : '直播内容准备中')}</p>
        </div>
      </section>
      <aside className="live-interaction" aria-label="直播互动">
        <Link to="/map" className="live-interaction__back">← 返回地图</Link>
        <h1>{liveConfig?.digitalHuman ? `和${liveConfig.digitalHuman.displayName}聊一聊` : '和数字人聊一聊'}</h1>
        {liveConfig?.digitalHuman ? <p className="live-interaction__presenter">当前主播：{liveConfig.digitalHuman.displayName}</p> : null}
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
