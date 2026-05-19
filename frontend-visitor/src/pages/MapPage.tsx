import { useEffect, useState } from 'react'
import axios from 'axios'
import '../App.css'
import { AppTopNav } from '../components/AppTopNav'

type Props = {
  onLogout: () => void
}

type ScenicSpot = {
  id: string
  area: string
  name: string
  description: string
  openHours: string
  tags: string[]
}

export function MapPage({ onLogout }: Props) {
  const [spots, setSpots] = useState<ScenicSpot[]>([])

  useEffect(() => {
    async function loadSpots() {
      const response = await axios.get<ScenicSpot[]>('/api/user/scenic/spots')
      setSpots(response.data)
    }

    void loadSpots()
  }, [])

  return (
    <main className="page-shell">
      <AppTopNav onLogout={onLogout} />
      <section className="page-content">
        <header className="page-heading">
          <p className="surface-tag">Map</p>
          <h1>景点地图</h1>
          <p className="surface-copy">这一阶段先放景点分布和路线入口，后面再接真实地图交互。</p>
        </header>
        <section className="map-placeholder">
          <div className="map-placeholder__panel">景点分布图占位，当前接入景点数据列表</div>
        </section>
        <section className="feature-grid">
          {spots.map((spot) => (
            <article key={spot.id} className="feature-card">
              <p className="card-kicker">{spot.area}</p>
              <h2>{spot.name}</h2>
              <p>{spot.description}</p>
              <p>开放时间：{spot.openHours}</p>
              <div className="tag-group">
                {spot.tags.map((tag) => (
                  <span key={tag} className="info-tag">{tag}</span>
                ))}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  )
}
