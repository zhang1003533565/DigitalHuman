import { useEffect, useState } from 'react'
import axios from 'axios'
import '../App.css'
import { AppTopNav } from '../components/AppTopNav'

type Props = {
  onLogout: () => void
}

type ScenicRoute = {
  id: string
  name: string
  suitableFor: string
  duration: string
  reason: string
  spots: string[]
}

export function RouteRecommendPage({ onLogout }: Props) {
  const [interest, setInterest] = useState('')
  const [routes, setRoutes] = useState<ScenicRoute[]>([])

  useEffect(() => {
    async function loadRoutes() {
      const response = await axios.get<ScenicRoute[]>('/api/scenic/routes/recommend', {
        params: interest ? { interest } : {},
      })
      setRoutes(response.data)
    }

    void loadRoutes()
  }, [interest])

  return (
    <main className="page-shell">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">Route</p>
          <h1>路线推荐</h1>
          <p className="surface-copy">这一阶段先做官方路线模板展示，后续再接接口动态推荐。</p>
        </header>
        <section className="feature-card">
          <label className="label" htmlFor="interest-select">兴趣偏好</label>
          <select
            id="interest-select"
            value={interest}
            onChange={(event) => setInterest(event.target.value)}
          >
            <option value="">全部</option>
            <option value="历史文化">历史文化</option>
            <option value="自然风光">自然风光</option>
            <option value="亲子家庭">亲子家庭</option>
          </select>
        </section>
        <section className="feature-grid">
          {routes.map((route, index) => (
            <article
              key={route.id}
              className={`feature-card${index === 0 ? ' feature-card--primary' : ''}`}
            >
              <p className="card-kicker">{route.suitableFor}</p>
              <h2>{route.name}</h2>
              <p>{route.reason}</p>
              <p>建议时长：{route.duration}</p>
              <div className="tag-group">
                {route.spots.map((spot) => (
                  <span key={spot} className="info-tag">{spot}</span>
                ))}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
