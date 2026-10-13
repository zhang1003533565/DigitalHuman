import { useCallback, useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import './FloatingAiAssistant.css'

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
  pending?: boolean
}

/**
 * Pet behaviour states, modelled on the Codex desktop pet:
 * - idle      : floats gently, blinks, looks around
 * - attention : notices the cursor nearby, perks up and watches it
 * - pet       : being stroked / clicked, giggles and squishes
 * - drag      : picked up and carried around
 * - happy     : short celebration after a drop or a successful answer
 * - thinking  : an answer is streaming in
 * - listening : the chat panel is open, waiting for input
 */
type PetMood = 'idle' | 'attention' | 'pet' | 'drag' | 'happy' | 'thinking' | 'listening'

const SESSION_KEY = 'digitalhuman.visitor.guideSessionId'
const USER_KEY = 'digitalhuman.visitor.user'
const QUICK_QUESTIONS = ['大境门有哪些必看景点？', '帮我安排半日游路线', '景区里哪里适合拍照？']

/** Playful reaction lines the pet says when you interact with it. */
const PET_LINES = [
  '嘿嘿，好痒呀～',
  '别挠啦，我怕痒！',
  '在的在的，随时待命！',
  '要不要听听大境门的故事？',
  '今天想去哪儿逛逛？',
  '摸摸头，元气满满！',
  '我一直在这儿陪着你～',
  '悄悄告诉你，傍晚的城墙超好看。',
]
const HAPPY_LINES = ['飞起来啦！', '落稳啦，继续玩～', '哇哦——好高！']
const GRAB_LINES = ['抓到我啦～', '哇，起飞！']

const POKE_COOLDOWN_MS = 900

function getToken() {
  try {
    const raw = window.sessionStorage.getItem(USER_KEY)
    const parsed = raw ? JSON.parse(raw) as { token?: unknown } : null
    return typeof parsed?.token === 'string' ? parsed.token : undefined
  } catch {
    return undefined
  }
}

function createMessage(role: ChatMessage['role'], content: string, pending = false): ChatMessage {
  return { id: `${role}-${Date.now()}-${Math.random()}`, role, content, pending }
}

function pickLine(lines: string[], avoid?: string) {
  if (lines.length < 2) return lines[0]
  let next = lines[Math.floor(Math.random() * lines.length)]
  let guard = 0
  while (next === avoid && guard < 8) {
    next = lines[Math.floor(Math.random() * lines.length)]
    guard += 1
  }
  return next
}

type StreamPayload = { sessionId?: string; token?: string; content?: string; answer?: string; delta?: string; text?: string; message?: string; error?: string }

async function consumeGuideStream(response: Response, onSession: (id: string) => void, onText: (text: string) => void) {
  if (!response.body) throw new Error('服务暂时不可用，请稍后再试。')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let answer = ''
  let streamError = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload) as StreamPayload
        if (parsed.sessionId) onSession(parsed.sessionId)
        if (parsed.error) {
          streamError = String(parsed.error)
          continue
        }
        const next = parsed.token ?? parsed.content ?? parsed.answer ?? parsed.delta ?? parsed.text ?? parsed.message ?? ''
        if (!next) continue
        answer += next
        onText(answer)
      } catch {
        // Ignore malformed keep-alive chunks and continue the stream.
      }
    }
  }
  if (!answer.trim()) throw new Error(streamError || '暂时没有生成回答，请换个问题试试。')
}

export function FloatingAiAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage('assistant', '你好，我是灵灵。想了解景点、路线或游玩贴士，都可以问我。'),
  ])
  const [position, setPosition] = useState({ right: 24, bottom: 88 })
  /**
   * Only *transient* reactions are stored. The ambient mood is derived from
   * `isOpen` + cursor proximity, so no effect has to write state back into React.
   */
  const [reaction, setReaction] = useState<PetMood | null>(null)
  const [isNearby, setIsNearby] = useState(false)
  const [bubble, setBubble] = useState<string | null>(null)
  const [facing, setFacing] = useState<1 | -1>(1)

  const dragRef = useRef<{ pointerId: number; x: number; y: number; right: number; bottom: number; moved: boolean; lastX: number } | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const petRef = useRef<HTMLButtonElement | null>(null)
  const messageIdRef = useRef(0)
  const moodTimerRef = useRef<number | null>(null)
  const bubbleTimerRef = useRef<number | null>(null)
  const lastPokeRef = useRef(0)
  const lastLineRef = useRef<string | undefined>(undefined)

  const mood: PetMood = reaction ?? (isSending ? 'thinking' : isOpen ? 'listening' : isNearby ? 'attention' : 'idle')

  const clearMoodTimer = useCallback(() => {
    if (moodTimerRef.current !== null) {
      window.clearTimeout(moodTimerRef.current)
      moodTimerRef.current = null
    }
  }, [])

  /** Drop the transient reaction after a beat, falling back to the ambient mood. */
  const settleMood = useCallback((delay = 900) => {
    clearMoodTimer()
    moodTimerRef.current = window.setTimeout(() => {
      moodTimerRef.current = null
      setReaction(null)
    }, delay)
  }, [clearMoodTimer])

  const say = useCallback((text: string, duration = 2200) => {
    setBubble(text)
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current)
    bubbleTimerRef.current = window.setTimeout(() => setBubble(null), duration)
  }, [])

  const react = useCallback((lines: string[], nextMood: PetMood, duration = 900, sayMs = 2200) => {
    const line = pickLine(lines, lastLineRef.current)
    lastLineRef.current = line
    setReaction(nextMood)
    say(line, sayMs)
    settleMood(duration)
  }, [say, settleMood])

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  // Cursor proximity: the pet perks up when the pointer wanders close to it.
  useEffect(() => {
    if (isOpen) return
    function handleMove(event: PointerEvent) {
      if (dragRef.current) return
      const node = petRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const distance = Math.hypot(event.clientX - cx, event.clientY - cy)
      setFacing(event.clientX < cx ? -1 : 1)
      setIsNearby(distance < 190)
    }
    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => window.removeEventListener('pointermove', handleMove)
  }, [isOpen])

  useEffect(() => () => {
    clearMoodTimer()
    if (bubbleTimerRef.current !== null) window.clearTimeout(bubbleTimerRef.current)
  }, [clearMoodTimer])

  function handlePetPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      right: position.right,
      bottom: position.bottom,
      moved: false,
      lastX: event.clientX,
    }
    clearMoodTimer()
    setReaction('pet')
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePetPointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    const dx = event.clientX - drag.lastX
    if (Math.abs(dx) > 1) setFacing(dx < 0 ? -1 : 1)
    drag.lastX = event.clientX

    if (!drag.moved && Math.abs(event.clientX - drag.x) + Math.abs(event.clientY - drag.y) > 6) {
      drag.moved = true
      setReaction('drag')
      say(pickLine(GRAB_LINES), 1400)
    }
    if (!drag.moved) return

    setPosition({
      right: Math.max(12, Math.min(window.innerWidth - 76, drag.right - (event.clientX - drag.x))),
      bottom: Math.max(76, Math.min(window.innerHeight - 76, drag.bottom - (event.clientY - drag.y))),
    })
  }

  function handlePetPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)

    if (drag.moved) {
      const line = pickLine(HAPPY_LINES, lastLineRef.current)
      lastLineRef.current = line
      setReaction('happy')
      say(line, 1800)
      settleMood(1100)
      return
    }

    poke()
  }

  /**
   * A tap always does the most useful thing for the current state: it opens
   * the chat when closed, and pets the mascot when the chat is already open.
   */
  function poke() {
    const now = Date.now()
    if (now - lastPokeRef.current < POKE_COOLDOWN_MS) return
    lastPokeRef.current = now

    if (!isOpen) {
      setIsOpen(true)
      setReaction(null)
      say('我们聊聊吧～', 1800)
      return
    }
    react(PET_LINES, 'pet', 900)
  }

  function handlePetKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
    event.preventDefault()
    poke()
  }

  async function sendQuestion(questionInput: string) {
    const question = questionInput.trim()
    if (!question || isSending) return
    setDraft('')
    setIsOpen(true)
    setIsSending(true)
    setReaction(null)
    clearMoodTimer()
    messageIdRef.current += 1
    const assistantId = `assistant-${messageIdRef.current}`
    setMessages((current) => [...current, createMessage('user', question), { id: assistantId, role: 'assistant', content: '正在想办法...', pending: true }])

    try {
      const token = getToken()
      const response = await fetch('/api/user/guide/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          sessionId: window.sessionStorage.getItem(SESSION_KEY) || undefined,
          question,
        }),
      })
      if (!response.ok || !response.body) throw new Error('服务暂时不可用，请稍后再试。')

      await consumeGuideStream(
        response,
        (sessionId) => window.sessionStorage.setItem(SESSION_KEY, sessionId),
        (answer) => setMessages((current) => current.map((message) => message.id === assistantId ? { ...message, content: answer, pending: false } : message)),
      )
      setReaction('happy')
      say('答完啦，还有想问的吗？', 2600)
      settleMood(1400)
    } catch (error) {
      const message = error instanceof Error ? error.message : '服务暂时不可用，请稍后再试。'
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: message, pending: false } : item))
      setReaction(null)
      say('咦，好像没连上，再试一次？', 2600)
    } finally {
      setIsSending(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendQuestion(draft)
  }

  return (
    <div className={`floating-ai${isOpen ? ' floating-ai--open' : ''}`} style={{ right: position.right, bottom: position.bottom }}>
      {isOpen ? (
        <section className="floating-ai__panel" aria-label="灵灵 AI 助手">
          <header className="floating-ai__header">
            <div className="floating-ai__identity">
              <span className={`floating-ai__avatar floating-ai__avatar--${mood}`} aria-hidden="true">
                <img src="/ai-helper-pet.png" alt="" />
              </span>
              <div><strong>灵灵 AI 助手</strong><span>随时为你解答游览问题</span></div>
            </div>
            <button className="floating-ai__icon-button" type="button" aria-label="收起助手" title="收起" onClick={() => setIsOpen(false)}>×</button>
          </header>
          <div className="floating-ai__messages" ref={messagesRef} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`floating-ai__message floating-ai__message--${message.role}`}>
                <p>{message.content}{message.pending ? <span className="floating-ai__typing" aria-label="正在输入">...</span> : null}</p>
              </div>
            ))}
          </div>
          <div className="floating-ai__quick-questions">
            {QUICK_QUESTIONS.map((question) => <button key={question} type="button" onClick={() => void sendQuestion(question)} disabled={isSending}>{question}</button>)}
          </div>
          <form className="floating-ai__composer" onSubmit={handleSubmit}>
            <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="问问灵灵..." aria-label="输入问题" maxLength={200} />
            <button type="submit" aria-label="发送问题" title="发送" disabled={!draft.trim() || isSending}>↑</button>
          </form>
        </section>
      ) : null}

      <div className={`floating-ai__pet-stage floating-ai__pet-stage--${mood}`}>
        {bubble ? <span className="floating-ai__bubble" role="status">{bubble}</span> : null}
        <button
          ref={petRef}
          className="floating-ai__pet"
          type="button"
          aria-label={isOpen ? '收起灵灵 AI 助手' : '打开灵灵 AI 助手'}
          title="点点我，或者拖着我走"
          style={{ ['--pet-facing' as string]: facing }}
          onPointerDown={handlePetPointerDown}
          onPointerMove={handlePetPointerMove}
          onPointerUp={handlePetPointerUp}
          onKeyDown={handlePetKeyDown}
        >
          <span className="floating-ai__pet-shadow" aria-hidden="true" />
          <span className="floating-ai__pet-body">
            <img src="/ai-helper-pet.png" alt="灵灵 AI 助手" draggable={false} />
          </span>
          <span className="floating-ai__sparkles" aria-hidden="true"><i /><i /><i /></span>
        </button>
        {!bubble && !isOpen ? <span className="floating-ai__hint">来问我吧</span> : null}
      </div>
    </div>
  )
}
