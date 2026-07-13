import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './RouteRecommendListPage.css'

interface RouteItem {
  id: string
  title: string
  imageUrl: string
  description: string
}

export function RouteRecommendListPage() {
  const navigate = useNavigate()
  const [routes, setRoutes] = useState<RouteItem[]>([])

  useEffect(() => {
    fetch('/api/home')
      .then(res => res.json())
      .then(data => setRoutes(data.routeRecommends || []))
      .catch(() => {})
  }, [])

  return (
    <main className="page-shell">
      <section className="page-content">
        <div className="route-list-page">
          <div className="route-list-page__header">
            <button className="route-list-page__back" onClick={() => navigate('/home')}>← 返回首页</button>
            <h1>🚶 今日路线推荐</h1>
            <p>为您规划最佳游览路线，轻松畅游灵山胜境</p>
          </div>
          <div className="route-list-page__grid">
            {routes.map(route => (
              <article key={route.id} className="route-list-page__card">
                <img src={route.imageUrl} alt={route.title} />
                <div className="route-list-page__card-body">
                  <h3>{route.title}</h3>
                  <p>{route.description}</p>
                </div>
              </article>
            ))}
          </div>
          {routes.length === 0 && (
            <div className="route-list-page__empty">暂无路线推荐</div>
          )}
        </div>
      </section>
    </main>
  )
}
