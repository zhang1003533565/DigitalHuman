import { useEffect, useState } from 'react'
import axios from 'axios'
import './FeedbackPage.css'
import { AppTopNav } from '../components/AppTopNav'
import { parseNavigationContext } from './navigationContext'

type Props = {
  onLogout: () => void
}

type FeedbackRecord = {
  sessionId: string
  question: string
  answer: string
  helpful: boolean
  rating: number
  comment: string
  timestamp: number
}

export function FeedbackPage({ onLogout }: Props) {
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [comment, setComment] = useState('')
  const [submitState, setSubmitState] = useState('')
  const context = parseNavigationContext(window.location.search)

  async function submitGeneralFeedback() {
    const value = comment.trim()
    if (!value) return
    setSubmitState('提交中…')
    try {
      await axios.post('/api/user/guide/feedback', {
        sessionId: context.sessionId || undefined,
        traceId: context.traceId || undefined,
        routeId: context.routeId || undefined,
        question: '游客普通意见',
        helpful: true,
        rating: 5,
        comment: value,
        category: context.sessionId || context.traceId || context.routeId ? 'CONTEXTUAL' : 'GENERAL',
      })
      setComment('')
      setSubmitState('感谢反馈，已提交。')
    } catch {
      setSubmitState('提交失败，请稍后重试。')
    }
  }

  useEffect(() => {
    async function loadFeedback() {
      const response = await axios.get<FeedbackRecord[]>('/api/guide/feedback')
      setRecords(response.data)
    }

    void loadFeedback()
  }, [])

  return (
    <main className="page-shell feedback-page">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">Feedback</p>
          <h1>反馈记录</h1>
          <p className="surface-copy">当前页面已接后端反馈列表，后续再补筛选和统计。</p>
        </header>
        <section className="feature-card" aria-label="提交普通意见">
          <p className="card-kicker">提交意见</p>
          <h2>告诉我们哪里还可以做得更好</h2>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="输入你的意见" />
          <button type="button" onClick={() => void submitGeneralFeedback()} disabled={!comment.trim() || submitState === '提交中…'}>提交反馈</button>
          {submitState ? <p role="status">{submitState}</p> : null}
        </section>
        <section className="feature-grid">
          {records.length === 0 ? (
            <article className="feature-card">
              <p className="card-kicker">暂无数据</p>
              <h2>还没有提交反馈</h2>
            </article>
          ) : (
            records.map((record) => (
              <article key={`${record.sessionId}-${record.timestamp}`} className="feature-card">
                <p className="card-kicker">{record.helpful ? '有帮助' : '待优化'}</p>
                <h2>{record.question}</h2>
                <p>{record.answer || '暂无回答摘要'}</p>
                <p>评分：{record.rating}/5</p>
                {record.comment ? <p>意见：{record.comment}</p> : null}
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  )
}
