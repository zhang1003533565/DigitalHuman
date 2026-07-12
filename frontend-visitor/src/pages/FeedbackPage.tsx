import { useEffect, useState } from 'react'
import axios from 'axios'
import './FeedbackPage.css'
import { VisitorTopNav } from '../components/VisitorTopNav'
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
  createdAt: string
  routeId?: string
  messageId?: number
  status: string
  category: string
  adminNote?: string
}

export function FeedbackPage({ onLogout }: Props) {
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [comment, setComment] = useState('')
  const [submitState, setSubmitState] = useState('')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [reloadKey, setReloadKey] = useState(0)
  const context = parseNavigationContext(window.location.search)
  const sessionId = context.sessionId || window.sessionStorage.getItem('digitalhuman.visitor.guideSessionId') || ''

  async function submitGeneralFeedback() {
    const value = comment.trim()
    if (!value) return
    setSubmitState('提交中…')
    try {
      await axios.post('/api/user/guide/feedback', {
        sessionId: sessionId || undefined,
        traceId: context.traceId || undefined,
        routeId: context.routeId || undefined,
        messageId: context.messageId,
        question: '游客普通意见',
        helpful: true,
        rating: 5,
        comment: value,
      })
      setComment('')
      setSubmitState('感谢反馈，已提交。')
    } catch {
      setSubmitState('提交失败，请稍后重试。')
    }
  }

  useEffect(() => {
    if (!sessionId) {
      return
    }
    async function loadFeedback() {
      setLoadState('loading')
      try {
        const response = await axios.get<FeedbackRecord[]>('/api/user/guide/feedback', { params: { sessionId } })
        setRecords(response.data)
        setLoadState('idle')
      } catch {
        setLoadState('error')
      }
    }

    void loadFeedback()
  }, [sessionId, reloadKey])

  return (
    <main className="page-shell feedback-page">
      <VisitorTopNav onLogout={onLogout} />
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
          {loadState === 'loading' ? (
            <article className="feature-card"><p role="status">正在加载反馈记录…</p></article>
          ) : loadState === 'error' ? (
            <article className="feature-card"><h2>反馈记录加载失败</h2><button type="button" onClick={() => setReloadKey((value) => value + 1)}>重试</button></article>
          ) : records.length === 0 ? (
            <article className="feature-card">
              <p className="card-kicker">暂无数据</p>
              <h2>{sessionId ? '当前会话还没有提交反馈' : '开始一次数字人对话后即可查看反馈记录'}</h2>
            </article>
          ) : (
            records.map((record) => (
              <article key={`${record.sessionId}-${record.createdAt}`} className="feature-card">
                <p className="card-kicker">{record.helpful ? '有帮助' : '待优化'}</p>
                <h2>{record.question}</h2>
                <p>{record.answer || '暂无回答摘要'}</p>
                <p>评分：{record.rating}/5</p>
                {record.comment ? <p>意见：{record.comment}</p> : null}
                <p>分类：{record.category} · 状态：{record.status}</p>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  )
}
