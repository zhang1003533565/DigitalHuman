import axios from 'axios'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLiveStatus, type LiveStatusSnapshot } from '../api/liveBroadcast'
import { getStoredUser } from '../auth/session'
import { VisitorTopNav } from '../components/VisitorTopNav'
import {
  createTtsPayload,
  loadLive2dScripts,
  MODEL_OPTIONS,
  resolveModelUrl,
  TTS_ENDPOINT,
  type Live2DModel,
  type PixiApplication,
} from '../digitalHuman/shared'
import { resolveCurrentLivePosition, type LivePosition } from '../live/liveTimeline'
import { createLiveSpeechKey, parseLiveGuideStreamData } from '../live/liveBroadcastRuntime'
import './LiveBroadcastPage.css'

type LivePhase = 'syncing' | 'broadcasting' | 'asking' | 'answering' | 'resuming' | 'unavailable' | 'error'
type LiveBroadcastPageProps = { onLogout: () => void }
type SpeechRecognitionResultEvent = Event & { results: { 0: { 0: { transcript: string } } } }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null
  onerror: (() => void) | null
  start: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const LIVE_GUIDE_SESSION_KEY = 'digitalhuman.visitor.liveGuideSessionId'

export function LiveBroadcastPage({ onLogout }: LiveBroadcastPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const modelRef = useRef<Live2DModel | null>(null)
  const pixiRef = useRef<PixiApplication | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const audioCleanupRef = useRef<(() => void) | null>(null)
  const versionRef = useRef<number | null>(null)
  const syncSequenceRef = useRef(0)
  const spokenItemRef = useRef<string | null>(null)
  const speechGenerationRef = useRef(0)
  const snapshotRef = useRef<LiveStatusSnapshot | null>(null)
  const [phase, setPhase] = useState<LivePhase>('syncing')
  const [position, setPosition] = useState<LivePosition | null>(null)
  const [snapshot, setSnapshot] = useState<LiveStatusSnapshot | null>(null)
  const [draft, setDraft] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

  const stopPlayback = useCallback(() => {
    requestRef.current?.abort()
    requestRef.current = null
    audioCleanupRef.current?.()
    audioCleanupRef.current = null
    modelRef.current?.stopSpeaking?.()
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
  }, [])

  const playText = useCallback(async (text: string, signal: AbortSignal) => {
    const response = await axios.post(TTS_ENDPOINT, createTtsPayload(text), { responseType: 'blob', signal })
    if (signal.aborted) return
    const audioUrl = URL.createObjectURL(response.data)
    audioUrlRef.current = audioUrl
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
        if (audioUrlRef.current === audioUrl) audioUrlRef.current = null
        URL.revokeObjectURL(audioUrl)
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

  const applySnapshot = useCallback((snapshot: LiveStatusSnapshot) => {
    if (snapshot.status !== 'live') {
      snapshotRef.current = snapshot
      setSnapshot(snapshot)
      setPosition(null)
      setPhase('unavailable')
      return
    }
    if (versionRef.current !== null && versionRef.current !== snapshot.versionId) {
      stopPlayback()
      spokenItemRef.current = null
    }
    versionRef.current = snapshot.versionId ?? null
    snapshotRef.current = snapshot
    setSnapshot(snapshot)
    const next = resolveCurrentLivePosition(snapshot, Date.now())
    setPosition(next)
    setPhase(next ? 'broadcasting' : 'unavailable')
  }, [stopPlayback])

  const syncLiveStatus = useCallback(async (reason: string) => {
    const sequence = ++syncSequenceRef.current
    stopPlayback()
    spokenItemRef.current = null
    speechGenerationRef.current += 1
    const controller = new AbortController()
    requestRef.current = controller
    setPhase(reason === 'initial' ? 'syncing' : 'resuming')
    setError('')
    try {
      const snapshot = await getLiveStatus({ signal: controller.signal })
      if (sequence !== syncSequenceRef.current || controller.signal.aborted) return
      applySnapshot(snapshot)
    } catch (syncError) {
      if (controller.signal.aborted) return
      setError(syncError instanceof Error ? syncError.message : '直播同步失败')
      setPhase('error')
    }
  }, [applySnapshot, stopPlayback])

  useEffect(() => {
    const initialSync = window.setTimeout(() => void syncLiveStatus('initial'), 0)
    const timer = window.setInterval(() => {
      const snapshot = snapshotRef.current
      if (snapshot?.status === 'live') setPosition(resolveCurrentLivePosition(snapshot, Date.now()))
    }, 250)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void syncLiveStatus('visibility-resume')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(timer)
      window.clearTimeout(initialSync)
      document.removeEventListener('visibilitychange', handleVisibility)
      syncSequenceRef.current += 1
      stopPlayback()
    }
  }, [stopPlayback, syncLiveStatus])

  useEffect(() => {
    if (phase !== 'broadcasting' || !position) return
    const speechKey = createLiveSpeechKey(position.versionId, position.item.itemId, speechGenerationRef.current)
    if (spokenItemRef.current === speechKey) return
    spokenItemRef.current = speechKey
    stopPlayback()
    const controller = new AbortController()
    requestRef.current = controller
    void playText(position.item.content, controller.signal).catch(() => undefined)
  }, [phase, playText, position, stopPlayback])

  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current
    if (!canvas) return
    void loadLive2dScripts().then(async () => {
      if (cancelled || !window.PIXI) return
      const app = new window.PIXI.Application({ view: canvas, autoStart: true, resizeTo: canvas.parentElement ?? window, backgroundAlpha: 0 })
      const model = await window.PIXI.live2d.Live2DModel.from(resolveModelUrl(MODEL_OPTIONS[0]))
      if (cancelled) { model.destroy?.(); app.destroy(true, { children: true }); return }
      model.scale.set(0.24)
      model.position.x = canvas.clientWidth / 2
      model.position.y = canvas.clientHeight * 0.08
      app.stage.addChild(model)
      pixiRef.current = app
      modelRef.current = model
    }).catch(() => {
      if (!cancelled) setError('数字人舞台加载失败，直播字幕仍可继续观看。')
    })
    return () => { cancelled = true; modelRef.current?.destroy?.(); pixiRef.current?.destroy(true, { children: true }) }
  }, [])

  async function askQuestion(event: FormEvent) {
    event.preventDefault()
    const question = draft.trim()
    if (!question) return
    stopPlayback()
    setPhase('asking')
    setAnswer('')
    const controller = new AbortController()
    requestRef.current = controller
    let receivedAnswer = false
    try {
      const user = getStoredUser()
      const response = await fetch('/api/user/guide/chat/stream', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}) },
        body: JSON.stringify({ sessionId: window.sessionStorage.getItem(LIVE_GUIDE_SESSION_KEY) || undefined, question }),
      })
      if (!response.ok || !response.body) throw new Error('个人问答服务暂时不可用')
      setPhase('answering')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''; let fullAnswer = ''
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
            if (data.token) { fullAnswer += data.token; setAnswer(fullAnswer) }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) continue
            throw parseError
          }
        }
      }
      if (!fullAnswer.trim()) throw new Error('个人问答没有返回有效内容')
      receivedAnswer = true
      try {
        await playText(fullAnswer, controller.signal)
      } catch (speechError) {
        if (!controller.signal.aborted) setError(speechError instanceof Error ? `回答已生成，但${speechError.message}` : '回答语音播放失败')
      }
    } catch (askError) {
      if (controller.signal.aborted) return
      setError(askError instanceof Error ? askError.message : '提问失败')
      setPhase('error')
    } finally {
      if (receivedAnswer && !controller.signal.aborted) await syncLiveStatus('answer-complete')
    }
  }

  function startVoiceQuestion() {
    const SpeechRecognition = (window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }).SpeechRecognition ?? (window as typeof window & { webkitSpeechRecognition?: SpeechRecognitionConstructor }).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError('当前浏览器未提供语音识别，请使用文字提问。')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = false
    recognition.onresult = (event) => setDraft(event.results[0][0].transcript)
    recognition.onerror = () => setError('没有识别到语音，请重试或使用文字提问。')
    recognition.start()
  }

  const nextItem = position && snapshot?.items?.[(position.itemIndex + 1) % (snapshot.items.length || 1)]
  const progress = position ? Math.min(100, position.itemOffsetMs / position.item.durationMs * 100) : 0
  const isInteractionBusy = ['syncing', 'asking', 'answering', 'resuming'].includes(phase)

  return <div className="live-broadcast-page">
    <VisitorTopNav onLogout={onLogout} />
    <main className="live-broadcast-page__body">
      <section className="live-stage" aria-label="数字人直播舞台">
        <canvas ref={canvasRef} className="live-stage__canvas" />
        <div className="live-stage__badge">{snapshot?.status === 'live' ? '直播中' : phase === 'error' ? '同步失败' : '准备中'}</div>
        <div className="live-stage__subtitle" aria-live="polite">
          <strong>{position?.item.title ?? (phase === 'unavailable' ? '直播内容准备中' : '正在同步直播')}</strong>
          <p>{position?.item.content ?? error}</p>
          {position && <div className="live-stage__progress"><span style={{ width: `${progress}%` }} /></div>}
          {nextItem && <small>下一条：{nextItem.title}</small>}
        </div>
      </section>
      <aside className="live-interaction">
        <Link to="/map" className="live-interaction__back">← 返回地图</Link>
        <h1>和数字人聊一聊</h1>
        <p className="live-interaction__hint">提问期间只会暂停你的本地直播语音，不影响其他游客。</p>
        {answer && <div className="live-interaction__answer" aria-live="polite">{answer}</div>}
        <form onSubmit={askQuestion}>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="输入你想了解的问题" />
          <div className="live-interaction__actions">
            <button type="button" onClick={startVoiceQuestion}>语音提问</button>
            <button type="submit" disabled={!draft.trim() || isInteractionBusy}>发送</button>
            <button type="button" onClick={() => { stopPlayback(); void syncLiveStatus('answer-complete') }}>停止本地回答</button>
          </div>
        </form>
      </aside>
    </main>
  </div>
}
