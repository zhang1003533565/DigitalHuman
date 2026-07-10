import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'
import { type SessionUser } from '../auth/session'
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

const HOME_NAV_ITEMS = [
  { to: '/home', label: '首页' },
  { to: '/modules/digital-human', label: 'AI 导览' },
  { to: '/routes', label: '路线' },
  { to: '/map', label: '地图' },
  { to: '/tips', label: '游览贴士' },
]

const DEFAULT_HOME_DATA: HomeData = {
  banners: [],
  ads: [],
  spotRecommends: [],
  routeRecommends: [],
}

export function HomePage({ user, onLogout }: HomePageProps) {
  const navigate = useNavigate()
  const [homeData, setHomeData] = useState<HomeData>(DEFAULT_HOME_DATA)
  const displayName = user.displayName || user.username

  useEffect(() => {
    fetch('/api/home')
      .then((response) => response.json())
      .then((data) => setHomeData(data))
      .catch(() => setHomeData(DEFAULT_HOME_DATA))
  }, [])

  const inspirationItems = [
    {
      title: '灵山大佛',
      imageUrl: '/home/hero-lingshan-dusk.png',
    },
    {
      title: '九龙灌浴',
      imageUrl: '/home/jiulong-bath.png',
    },
    {
      title: '梵宫',
      imageUrl: '/home/fangong-show.png',
    },
  ]

  return (
    <main className="page-shell home-page">
      <AppTopNav
        onLogout={onLogout}
        title="灵山智游"
        items={HOME_NAV_ITEMS}
        variant="home"
      />

      <div className="hp-scroll">
        <section className="hp-hero" aria-labelledby="home-hero-title">
          <img
            className="hp-hero__background"
            src="/home/hero-lingshan-dusk.png"
            alt="暮色中的灵山大佛与山林"
          />
          <div className="hp-hero__shade" />
          <div className="hp-hero__content">
            <p className="hp-hero__greeting">早上好，{displayName}</p>
            <h1 id="home-hero-title">
              今天，想怎样<span>游灵山</span>？
            </h1>
            <div className="hp-hero__actions">
              <button className="hp-button hp-button--primary" onClick={() => navigate('/modules/digital-human')}>
                让 AI 规划行程
              </button>
              <button className="hp-button hp-button--secondary" onClick={() => navigate('/map')}>
                查看景区地图
              </button>
            </div>
            <div className="hp-hero__status" aria-label="今日景区信息">
              <span>晴 26°C</span>
              <span>客流舒适</span>
              <span>建议游玩 5 小时</span>
            </div>
          </div>

          <div className="hp-guide" aria-label="AI 数字人导游">
            <p>告诉我同行人和时间，<br />我来安排</p>
            <img src="/home/ai-guide-robot.png" alt="灵山 AI 数字人导游" />
          </div>
        </section>

        <section className="hp-section" aria-labelledby="inspiration-title">
          <div className="hp-section__title">
            <span />
            <h2 id="inspiration-title">今日灵感</h2>
          </div>
          <div className="hp-inspiration">
            {inspirationItems.map((item) => (
              <button key={item.title} className="hp-inspiration__item" onClick={() => navigate('/map')}>
                <img src={item.imageUrl} alt={item.title} />
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="hp-section hp-route-section" aria-labelledby="route-title">
          <div className="hp-section__title">
            <span />
            <h2 id="route-title">为你推荐的路线</h2>
          </div>
          <div className="hp-route-grid">
            <button className="hp-route-card" onClick={() => navigate('/routes')}>
              <div className="hp-route-card__intro">
                <div className="hp-route-card__thumb">
                  <img src={inspirationItems[0].imageUrl} alt="禅意经典线路" />
                </div>
                <div>
                  <strong>禅意经典线 <small>· 4.5 小时</small></strong>
                  <span className="hp-route-card__badge">精选路线</span>
                </div>
              </div>
              <div className="hp-route-card__stops" aria-label="路线途经景点">
                <span>灵山大佛</span>
                <i />
                <span>九龙灌浴</span>
                <i />
                <span>梵宫</span>
              </div>
            </button>

            <button
              className="hp-show-card"
              title={homeData.ads[0]?.description || '查看梵宫演出安排'}
              onClick={() => navigate('/tips')}
            >
              <img src="/home/fangong-show.png" alt="梵宫演出" />
              <strong>梵宫演出 · 14:00</strong>
              <span aria-hidden="true">查看</span>
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
