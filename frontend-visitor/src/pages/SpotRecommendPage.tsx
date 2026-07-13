import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './SpotRecommendPage.css'

interface SpotItem {
  id: string
  title: string
  imageUrl: string
  description: string
}

export function SpotRecommendPage() {
  const navigate = useNavigate()
  const [spots, setSpots] = useState<SpotItem[]>([])

  useEffect(() => {
    fetch('/api/home')
      .then(res => res.json())
      .then(data => setSpots(data.spotRecommends || []))
      .catch(() => {})
  }, [])

  return (
    <main className="page-shell">
      <section className="page-content">
        <div className="spot-page">
          <div className="spot-page__header">
            <button className="spot-page__back" onClick={() => navigate('/home')}>← 返回首页</button>
            <h1>🏯 今日景点推荐</h1>
            <p>为您精选的热门景点，感受灵山胜境的独特魅力</p>
          </div>
          <div className="spot-page__grid">
            {spots.map(spot => (
              <article key={spot.id} className="spot-page__card">
                <img src={spot.imageUrl} alt={spot.title} />
                <div className="spot-page__card-body">
                  <h3>{spot.title}</h3>
                  <p>{spot.description}</p>
                </div>
              </article>
            ))}
          </div>
          {spots.length === 0 && (
            <div className="spot-page__empty">暂无景点推荐</div>
          )}
        </div>
      </section>
    </main>
  )
}
