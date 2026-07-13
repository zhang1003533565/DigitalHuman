import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import './HistoryPage.css'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import { loadHistoryMessages } from './historyMessageLoader'

type GuideMessage = {
  role: string
  content: string
  timestamp: number
}

const GUIDE_SESSION_KEY = 'digitalhuman.visitor.guideSessionId'

const formatMessageTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

export function HistoryPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<GuideMessage[]>([])
  const [sessionId] = useState(() => window.sessionStorage.getItem(GUIDE_SESSION_KEY) ?? '')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!sessionId) return

    const controller = new AbortController()
    async function loadMessages() {
      setLoadState('loading')
      const result = await loadHistoryMessages<GuideMessage>({
        signal: controller.signal,
        request: async (signal) => {
          const { data } = await axios.get<GuideMessage[]>(`/api/user/guide/session/${sessionId}/messages`, { signal })
          return data
        },
        isCanceled: axios.isCancel,
      })
      if (result.status === 'aborted') return
      if (result.status === 'error') {
        setLoadState('error')
        return
      }
      setMessages(result.messages)
      setLoadState('idle')
    }

    void loadMessages()

    return () => controller.abort()
  }, [reloadKey, sessionId])

  return (
    <main className="page-shell history-page">
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">History</p>
          <h1>会话历史</h1>
          <p className="surface-copy">这一阶段先做导览问答历史展示，方便比赛现场回看。</p>
        </header>
        <header className="history-mobile-head">
          <div>
            <span>导览记录</span>
            <h1>会话历史</h1>
          </div>
          {sessionId ? (
            <button type="button" onClick={() => navigate(`${DIGITAL_HUMAN_ROUTE}?sessionId=${encodeURIComponent(sessionId)}`)}>
              继续对话
            </button>
          ) : null}
        </header>
        <section className="feature-grid">
          {sessionId ? (
            <button type="button" className="feature-card" onClick={() => navigate(`${DIGITAL_HUMAN_ROUTE}?sessionId=${encodeURIComponent(sessionId)}`)}>
              <p className="card-kicker">恢复会话</p>
              <h2>继续本次数字人导览</h2>
            </button>
          ) : null}
          {!sessionId ? (
            <article className="feature-card">
              <p className="card-kicker">暂无会话</p>
              <h2>请先进入数字人导览页发起一次提问</h2>
            </article>
          ) : messages.map((message) => (
            <article key={`${message.role}-${message.timestamp}`} className="feature-card">
              <p className="card-kicker">{message.role === 'user' ? '用户提问' : '数字人回答'}</p>
              <h2>{formatMessageTime(message.timestamp)}</h2>
              <p>{message.content}</p>
            </article>
          ))}
        </section>
        <section className="history-timeline" aria-label="导览消息记录">
          {loadState === 'loading' ? <p className="history-state" role="status">正在加载会话记录…</p> : null}
          {loadState === 'error' ? (
            <div className="history-state">
              <p>会话记录加载失败</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)}>重试</button>
            </div>
          ) : null}
          {loadState === 'idle' && !sessionId ? (
            <p className="history-state">暂无会话，请先进入数字人导览页发起一次提问。</p>
          ) : null}
          {loadState === 'idle' && sessionId && messages.length === 0 ? (
            <p className="history-state">本次会话还没有消息记录。</p>
          ) : null}
          {loadState === 'idle' ? messages.map((message) => (
            <article key={`${message.role}-${message.timestamp}`} className={`history-message history-message--${message.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="history-message__meta">
                <span>{message.role === 'user' ? '我' : '灵灵'}</span>
                <time>{formatMessageTime(message.timestamp)}</time>
              </div>
              <p className="history-message__body">{message.content}</p>
            </article>
          )) : null}
        </section>
      </section>
    </main>
  )
}
