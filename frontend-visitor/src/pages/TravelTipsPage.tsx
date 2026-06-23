import { useEffect, useState } from 'react'
import axios from 'axios'
import './TravelTipsPage.css'
import { AppTopNav } from '../components/AppTopNav'

type Props = {
  onLogout: () => void
}

type TravelTip = {
  id: string
  title: string
  category: string
  content: string
  icon: string
  sortOrder: number
  enabled: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通指南',
  ticket: '门票信息',
  time: '最佳游览时间',
  items: '必备物品',
  safety: '安全提示',
  food: '餐饮推荐',
  notice: '注意事项',
}

const CATEGORY_ICONS: Record<string, string> = {
  transport: '🚌',
  ticket: '',
  time: '',
  items: '🎒',
  safety: '⚠️',
  food: '🍜',
  notice: '📋',
}

const ALL_CATEGORIES = ['all', 'transport', 'ticket', 'time', 'items', 'safety', 'food', 'notice']

export function TravelTipsPage({ onLogout }: Props) {
  const [tips, setTips] = useState<TravelTip[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadTips() {
      try {
        const response = await axios.get<TravelTip[]>('/api/user/travel-tips')
        setTips(response.data)
      } catch (err: any) {
        console.error('加载贴士失败:', err?.response?.status, err?.response?.data)
        setError(err?.response?.data?.message || '加载失败')
      }
    }
    void loadTips()
  }, [])

  const filteredTips = activeCategory === 'all'
    ? tips
    : tips.filter((tip) => tip.category === activeCategory)

  const groupedTips = filteredTips.reduce<Record<string, TravelTip[]>>((acc, tip) => {
    const cat = tip.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(tip)
    return acc
  }, {})

  return (
    <main className="page-shell travel-tips-page">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">Travel Tips</p>
          <h1>实用游览贴士</h1>
          <p className="surface-copy">全方位保障你的灵山之旅，出行前必看。</p>
        </header>

        <div className="tips-category-bar">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`tips-category-btn${activeCategory === cat ? ' tips-category-btn--active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat === 'all' ? '全部' : CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        <section className="tips-scroll-area">
          {error ? (
            <article className="feature-card tips-empty">
              <p className="card-kicker">加载失败</p>
              <h2>{error}</h2>
            </article>
          ) : Object.keys(groupedTips).length === 0 ? (
            <article className="feature-card tips-empty">
              <p className="card-kicker">暂无数据</p>
              <h2>该分类下暂无贴士</h2>
            </article>
          ) : (
            Object.entries(groupedTips).map(([category, categoryTips]) => (
              <div key={category} className="tips-category-group">
                <h2 className="tips-group-title">
                  <span className="tips-group-icon">{CATEGORY_ICONS[category] || '📌'}</span>
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <div className="tips-grid">
                  {categoryTips.map((tip) => (
                    <article key={tip.id} className="feature-card tips-card">
                      <h3 className="tips-card-title">{tip.title}</h3>
                      <p className="tips-card-content">{tip.content}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      </section>
    </main>
  )
}
