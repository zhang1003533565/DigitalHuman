import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import './HomePage.css'
import { type SessionUser } from '../auth/session'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import { AppTopNav } from '../components/AppTopNav'

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

export function HomePage({ user, onLogout }: HomePageProps) {
  const navigate = useNavigate()
  const [homeData, setHomeData] = useState<HomeData>({ banners: [], ads: [], spotRecommends: [], routeRecommends: [] })
  const [bannerIdx, setBannerIdx] = useState(0)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/home')
      .then(res => res.json())
      .then(data => setHomeData(data))
      .catch(() => {})
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const startTimer = useCallback(() => {
    stopTimer()
    timerRef.current = window.setInterval(() => {
      setBannerIdx(prev => (prev + 1) % homeData.banners.length)
    }, 4000)
  }, [homeData.banners.length, stopTimer])

  useEffect(() => {
    if (homeData.banners.length <= 1) return
    startTimer()
    return stopTimer
  }, [homeData.banners.length, startTimer, stopTimer])

  const goBanner = (i: number) => { setBannerIdx(i); startTimer() }

  return (
    <main className="page-shell home-page">
      <AppTopNav onLogout={onLogout} />

      <div className="hp-scroll">
        {/* ===== 轮播图 ===== */}
        {homeData.banners.length > 0 && (
          <div className="hp-banner-wrap">
            <div className="hp-banner">
              {homeData.banners.map((b, i) => (
                <div
                  key={b.id}
                  className={`hp-banner__item ${i === bannerIdx ? 'hp-banner__item--active' : ''}`}
                >
                  <img src={b.imageUrl} alt={b.title} />
                  <div className="hp-banner__text">
                    <h3>{b.title}</h3>
                    <p>{b.description}</p>
                  </div>
                </div>
              ))}
              <div className="hp-banner__indicators">
                {homeData.banners.map((_, i) => (
                  <button
                    key={i}
                    className={`hp-banner__dot ${i === bannerIdx ? 'hp-banner__dot--on' : ''}`}
                    onClick={(e) => { e.stopPropagation(); goBanner(i) }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== 欢迎栏 ===== */}
        <div className="hp-welcome">
          <div className="hp-welcome__left">
            <h2>Hi, {user.displayName || user.username} 👋</h2>
            <p>灵山胜境景区智慧导览，AI 数字人为您提供个性化游览服务</p>
          </div>
        </div>

        {/* ===== 广告通知 ===== */}
        {homeData.ads.length > 0 && (
          <div className="hp-ads-row">
            {homeData.ads.map(ad => (
              <div key={ad.id} className="hp-ad">
                <img src={ad.imageUrl} alt={ad.title} />
                <div className="hp-ad__text">
                  <strong>{ad.title}</strong>
                  <span>{ad.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===== 今日景点推荐 ===== */}
        {homeData.spotRecommends.length > 0 && (
          <section className="hp-block">
            <div className="hp-block__head">
              <h2>🏯 今日景点推荐</h2>
              <span onClick={() => navigate('/spot-recommend')}>查看全部 →</span>
            </div>
            <div className="hp-cards hp-cards--spot">
              {homeData.spotRecommends.map(spot => (
                <article key={spot.id} className="hp-card" onClick={() => navigate('/map')}>
                  <img src={spot.imageUrl} alt={spot.title} />
                  <div className="hp-card__info">
                    <h4>{spot.title}</h4>
                    <p>{spot.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ===== 今日路线推荐 ===== */}
        {homeData.routeRecommends.length > 0 && (
          <section className="hp-block">
            <div className="hp-block__head">
              <h2>🚶 今日路线推荐</h2>
              <span onClick={() => navigate('/route-recommend')}>查看全部 →</span>
            </div>
            <div className="hp-cards hp-cards--route">
              {homeData.routeRecommends.map(route => (
                <article key={route.id} className="hp-card hp-card--wide" onClick={() => navigate('/routes')}>
                  <img src={route.imageUrl} alt={route.title} />
                  <div className="hp-card__info">
                    <h4>{route.title}</h4>
                    <p>{route.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        </div>
    </main>
  )
}
