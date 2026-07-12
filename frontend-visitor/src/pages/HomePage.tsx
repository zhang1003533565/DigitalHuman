import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'
import { type SessionUser } from '../auth/session'
import { VisitorTopNav } from '../components/VisitorTopNav'
import { AsyncState } from '../components/AsyncState'
import { TripPlanner } from '../components/TripPlanner'

interface HomeItem {
  id: string
  type: string
  title: string
  imageUrl: string
  linkUrl: string
  description: string
  sortOrder: number
  enabled: boolean
}

interface HomeData {
  banners: HomeItem[]
  ads: HomeItem[]
  spotRecommends: HomeItem[]
  routeRecommends: HomeItem[]
}

type HomePageProps = {
  user: SessionUser
  onLogout: () => void
}

const EMPTY_HOME_DATA: HomeData = {
  banners: [],
  ads: [],
  spotRecommends: [],
  routeRecommends: [],
}

function normalizeHomeData(data: Partial<HomeData>): HomeData {
  return {
    banners: data.banners ?? [],
    ads: data.ads ?? [],
    spotRecommends: data.spotRecommends ?? [],
    routeRecommends: data.routeRecommends ?? [],
  }
}

export function HomePage({ user, onLogout }: HomePageProps) {
  const navigate = useNavigate()
  const [homeData, setHomeData] = useState<HomeData>(EMPTY_HOME_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [homeError, setHomeError] = useState<string | null>(null)
  const displayName = user.displayName || user.username

  useEffect(() => {
    fetch('/api/home')
      .then((response) => {
        if (!response.ok) throw new Error('首页内容加载失败，请稍后重试。')
        return response.json() as Promise<Partial<HomeData>>
      })
      .then((data) => setHomeData(normalizeHomeData(data)))
      .catch(() => setHomeError('首页内容加载失败，请稍后重试。'))
      .finally(() => setIsLoading(false))
  }, [])

  const hasHomeContent = Object.values(homeData).some((items) => items.length > 0)
  const heroImage = homeData.banners[0]?.imageUrl

  return (
    <main className="page-shell home-page">
      <VisitorTopNav onLogout={onLogout} />

      <div className="hp-scroll">
        <section className="hp-hero" aria-labelledby="home-hero-title">
          {heroImage && <img className="hp-hero__background" src={heroImage} alt={homeData.banners[0].title} />}
          <div className="hp-hero__shade" />
          <div className="hp-hero__content">
            <p className="hp-hero__greeting">早上好，{displayName}</p>
            <h1 id="home-hero-title">今天，想怎样<span>游灵山</span>？</h1>
            <TripPlanner onPlanned={(routeId) => navigate(`/routes?plan=${encodeURIComponent(routeId)}`)} />
            <div className="hp-hero__actions">
              <button className="hp-button hp-button--secondary" onClick={() => navigate('/map')}>查看景区地图</button>
            </div>
          </div>
          <div className="hp-guide" aria-label="AI 数字人导游">
            <p>告诉我同行人和时间，<br />我来安排</p>
            <img src="/home/ai-guide-robot.png" alt="灵山 AI 数字人导游" />
          </div>
        </section>

        <AsyncState isLoading={isLoading} error={homeError} isEmpty={!hasHomeContent} emptyMessage="首页推荐内容正在准备中，你仍可使用上方行程规划器生成专属路线。">
          <section className="hp-section" aria-labelledby="inspiration-title">
            <div className="hp-section__title"><span /><h2 id="inspiration-title">今日灵感</h2></div>
            <AsyncState isEmpty={homeData.spotRecommends.length === 0} emptyMessage="今日暂无景点推荐。">
              <div className="hp-inspiration">
                {homeData.spotRecommends.map((item) => (
                  <button key={item.id} className="hp-inspiration__item" onClick={() => navigate(item.linkUrl || '/map')}>
                    {item.imageUrl && <img src={item.imageUrl} alt={item.title} />}
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            </AsyncState>
          </section>

          <section className="hp-section hp-route-section" aria-labelledby="route-title">
            <div className="hp-section__title"><span /><h2 id="route-title">为你推荐的路线</h2></div>
            <AsyncState isEmpty={homeData.routeRecommends.length === 0 && homeData.ads.length === 0} emptyMessage="暂无运营路线推荐，可先使用快捷规划。">
              <div className="hp-route-grid">
                {homeData.routeRecommends.map((item) => (
                  <button key={item.id} className="hp-route-card" onClick={() => navigate(item.linkUrl || '/routes')}>
                    <div className="hp-route-card__intro">
                      {item.imageUrl && <div className="hp-route-card__thumb"><img src={item.imageUrl} alt="" /></div>}
                      <div><strong>{item.title}</strong><span className="hp-route-card__badge">官方推荐</span></div>
                    </div>
                    {item.description && <span className="hp-route-card__description">{item.description}</span>}
                  </button>
                ))}
                {homeData.ads.map((item) => (
                  <button key={item.id} className="hp-show-card" title={item.description} onClick={() => navigate(item.linkUrl || '/tips')}>
                    {item.imageUrl && <img src={item.imageUrl} alt="" />}
                    <strong>{item.title}</strong><span aria-hidden="true">查看</span>
                  </button>
                ))}
              </div>
            </AsyncState>
          </section>
        </AsyncState>
      </div>
    </main>
  )
}
