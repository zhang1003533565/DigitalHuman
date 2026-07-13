import { useEffect, useState } from 'react'
import axios from 'axios'
import './FeedbackPage.css'
import { parseNavigationContext } from './navigationContext'

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

const formatFeedbackTime = (createdAt: string) => new Date(createdAt).toLocaleString('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function FeedbackPage() {
  const [records, setRecords] = useState<FeedbackRecord[]>([])
  const [comment, setComment] = useState('')
  const [submitState, setSubmitState] = useState('')
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [reloadKey, setReloadKey] = useState(0)
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [expandedRecordKeys, setExpandedRecordKeys] = useState<Set<string>>(new Set())
  const context = parseNavigationContext(window.location.search)
  const sessionId = context.sessionId || window.sessionStorage.getItem('digitalhuman.visitor.guideSessionId') || ''

  function toggleRecord(recordKey: string) {
    setExpandedRecordKeys((current) => {
      const next = new Set(current)
      if (next.has(recordKey)) next.delete(recordKey)
      else next.add(recordKey)
      return next
    })
  }

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
      setIsComposerOpen(false)
      setReloadKey((value) => value + 1)
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
        <section className="feedback-mobile" aria-label="反馈记录">
          <header className="feedback-mobile-summary">
            <div>
              <span>服务反馈</span>
              <h1>反馈记录</h1>
            </div>
            <dl>
              <div><dt>本次记录</dt><dd>{records.length}</dd></div>
              <div><dt>已处理</dt><dd>{records.filter((record) => record.status === 'RESOLVED').length}</dd></div>
            </dl>
          </header>
          <section className="feedback-composer">
            <button
              type="button"
              className="feedback-composer__trigger"
              aria-expanded={isComposerOpen}
              onClick={() => setIsComposerOpen((open) => !open)}
            >
              <span>提交新反馈</span>
              <span aria-hidden="true">{isComposerOpen ? '收起' : '展开'}</span>
            </button>
            {isComposerOpen ? (
              <div className="feedback-composer__body">
                <label htmlFor="feedback-mobile-comment">告诉我们哪里还可以做得更好</label>
                <textarea
                  id="feedback-mobile-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="输入你的意见"
                />
                <div className="feedback-composer__actions">
                  <button type="button" onClick={() => void submitGeneralFeedback()} disabled={!comment.trim() || submitState === '提交中…'}>提交反馈</button>
                  <button type="button" onClick={() => setIsComposerOpen(false)}>取消</button>
                </div>
              </div>
            ) : null}
            {submitState ? <p className="feedback-composer__status" role="status">{submitState}</p> : null}
          </section>
          <section className="feedback-records" aria-live="polite">
            {loadState === 'loading' ? <p className="feedback-state" role="status">正在加载反馈记录…</p> : null}
            {loadState === 'error' ? (
              <div className="feedback-state">
                <p>反馈记录加载失败</p>
                <button type="button" onClick={() => setReloadKey((value) => value + 1)}>重试</button>
              </div>
            ) : null}
            {loadState === 'idle' && records.length === 0 ? (
              <p className="feedback-state">{sessionId ? '当前会话还没有提交反馈。' : '开始一次数字人对话后即可查看反馈记录。'}</p>
            ) : null}
            {loadState === 'idle' ? records.map((record) => {
              const recordKey = `${record.sessionId}-${record.createdAt}`
              const bodyId = `feedback-record-${recordKey}`
              return (
                <article key={recordKey} className="feedback-record">
                  <button
                    type="button"
                    className="feedback-record__summary"
                    aria-expanded={expandedRecordKeys.has(recordKey)}
                    aria-controls={bodyId}
                    onClick={() => toggleRecord(recordKey)}
                  >
                    <span className="feedback-record__heading">
                      <strong>{record.question}</strong>
                      <small>{record.helpful ? '有帮助' : '待优化'}</small>
                    </span>
                    <span className="feedback-record__meta">
                      <span>分类：{record.category}</span>
                      <span>评分：{record.rating}/5</span>
                      <time dateTime={record.createdAt}>{formatFeedbackTime(record.createdAt)}</time>
                    </span>
                  </button>
                  {expandedRecordKeys.has(recordKey) ? (
                    <div id={bodyId} className="feedback-record__body">
                      <div><span>数字人回答</span><p>{record.answer || '暂无回答摘要'}</p></div>
                      <div><span>我的意见</span><p>{record.comment || '未填写补充意见'}</p></div>
                      <div><span>处理状态</span><p>{record.status}</p></div>
                      {record.adminNote ? <div><span>管理员备注</span><p>{record.adminNote}</p></div> : null}
                    </div>
                  ) : null}
                </article>
              )
            }) : null}
          </section>
        </section>
      </section>
    </main>
  )
}
