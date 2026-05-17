import { useEffect, useState } from 'react'
import axios from 'axios'
import '../App.css'
import { AppTopNav } from '../components/AppTopNav'

type Props = {
  onLogout: () => void
}

type GuideMessage = {
  role: string
  content: string
  timestamp: number
}

const GUIDE_SESSION_KEY = 'digitalhuman.visitor.guideSessionId'

export function HistoryPage({ onLogout }: Props) {
  const [messages, setMessages] = useState<GuideMessage[]>([])
  const [sessionId] = useState(() => window.sessionStorage.getItem(GUIDE_SESSION_KEY) ?? '')

  useEffect(() => {
    async function loadMessages() {
      if (!sessionId) {
        return
      }

      const response = await axios.get<GuideMessage[]>(`/api/guide/session/${sessionId}/messages`)
      setMessages(response.data)
    }

    void loadMessages()
  }, [sessionId])

  return (
    <main className="page-shell">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">History</p>
          <h1>会话历史</h1>
          <p className="surface-copy">这一阶段先做导览问答历史展示，方便比赛现场回看。</p>
        </header>
        <section className="feature-grid">
          {!sessionId ? (
            <article className="feature-card">
              <p className="card-kicker">暂无会话</p>
              <h2>请先进入数字人导览页发起一次提问</h2>
            </article>
          ) : messages.map((message) => (
            <article key={`${message.role}-${message.timestamp}`} className="feature-card">
              <p className="card-kicker">{message.role === 'user' ? '用户提问' : '数字人回答'}</p>
              <h2>{new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</h2>
              <p>{message.content}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
