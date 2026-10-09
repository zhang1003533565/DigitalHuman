import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './SpotRecommendPage.css'

interface ScenicSpotCard {
  id: number
  scenicName: string
  spotId: string
  spotName: string
  location: string
  coreFunction: string
  highlights: string
  detailedIntroduction: string
}

const SPOT_CARD_LIMIT = 6

export function SpotRecommendPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [spots, setSpots] = useState<ScenicSpotCard[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const collectionTitle = searchParams.get('collectionTitle')?.trim()

  useEffect(() => {
    let isMounted = true

    axios.get<ScenicSpotCard[]>('/api/user/scenic/spot-cards')
      .then(({ data }) => {
        if (isMounted) setSpots(Array.isArray(data) ? data.slice(0, SPOT_CARD_LIMIT) : [])
      })
      .catch(() => {
        if (isMounted) setLoadError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <main className="page-shell">
      <section className="page-content">
        <div className="spot-page">
          <div className="spot-page__header">
            <button className="spot-page__back" onClick={() => navigate('/home')}>
              <span aria-hidden="true">←</span> 返回首页
            </button>
            <p className="spot-page__eyebrow">SCENIC SPOTS</p>
            <h1>{collectionTitle || '景点导览'}</h1>
            <p>在这里浏览景区景点介绍。</p>
          </div>

          {loading && <div className="spot-page__state" role="status">正在加载景点资料…</div>}
          {!loading && loadError && (
            <div className="spot-page__state" role="alert">景点资料暂时无法加载，请稍后重试。</div>
          )}
          {!loading && !loadError && spots.length > 0 && (
            <div className="spot-page__grid">
              {spots.map((spot, index) => {
                const description = spot.detailedIntroduction?.trim()
                  || spot.highlights?.trim()
                  || spot.coreFunction?.trim()
                  || '暂无详细介绍。'

                return (
                  <article key={spot.id} className="spot-page__card">
                    <div className="spot-page__card-banner">
                      <span className="spot-page__card-index">景点 {String(index + 1).padStart(2, '0')}</span>
                      {spot.scenicName && <span className="spot-page__scenic-name">{spot.scenicName}</span>}
                    </div>
                    <div className="spot-page__card-body">
                      <h2>{spot.spotName}</h2>
                      {spot.location && <p className="spot-page__location">{spot.location}</p>}
                      <p className="spot-page__description">{description}</p>
                      {spot.highlights && spot.highlights !== description && (
                        <p className="spot-page__highlight"><strong>游玩亮点：</strong>{spot.highlights}</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
          {!loading && !loadError && spots.length === 0 && (
            <div className="spot-page__state">
              暂无景点资料。请在后台“景点资料导入”中新增记录或导入景点资料。
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
