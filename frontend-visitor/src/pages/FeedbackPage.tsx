import { useEffect, useState } from 'react'
import axios from 'axios'
import '../App.css'
import { AppTopNav } from '../components/AppTopNav'

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

  useEffect(() => {
    async function loadFeedback() {
      const response = await axios.get<FeedbackRecord[]>('/api/guide/feedback')
      setRecords(response.data)
    }

    void loadFeedback()
  }, [])

  return (
    <main className="page-shell">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">Feedback</p>
          <h1>反馈记录</h1>
          <p className="surface-copy">当前页面已接后端反馈列表，后续再补筛选和统计。</p>
        </header>
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
