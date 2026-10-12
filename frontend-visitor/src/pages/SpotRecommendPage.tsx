import { useNavigate, useSearchParams } from 'react-router-dom'
import { useState, useRef, useCallback } from 'react'
import './SpotRecommendPage.css'

interface ScenicSpotCard {
  id: number
  scenicName: string
  spotName: string
  location: string
  images: string[]
  detailedIntroduction: string
  highlights: string[]
}

const SPOTS: ScenicSpotCard[] = [
  {
    id: 1,
    spotName: '📍 大境门长城',
    location: '河北省张家口市桥西区大境门景区（张家口市北环路附近，长城文化旅游带核心区域）',
    images: ['/home/dajingmengchangcheng1.jpg', '/home/dajingmenchangcheng3.jpg', '/home/dajingmenchangcheng2.png', '/home/dajingmenchangcheng4.jpg'],
    detailedIntroduction: '作为张家口城市象征，门楣“大好河山”气势雄浑，既是明清长城重要关隘、昔日张库大道的商贸起点，也见证了察哈尔地区近代革命风云；从这里出发，可沿古道深入周边村落，开启长城文化与红色乡土交织的乡野旅程',
    highlights: ['万里长城第一门', '张库大道起点','红色研学原点'],
    scenicName: ''
  },
  {
    id: 2,
    spotName: '📍 来远堡遗址公园',
    location: '河北省张家口市桥西区大境门街道大境门景区西南角',
    images: ['/home/laiyuanbu1.jpg', '/home/laiyuanbu3.jpg', '/home/laiyuanbu2.jpg'],
    detailedIntroduction: '紧邻大境门，是明代与大境门配套的商贸军堡，保留夯土城墙、古车辙遗迹；曾经是草原与中原物资互通的枢纽，如今活化成为长城文化研学节点，串联起通往周边乡村的徒步路线，带动近郊文旅发展。',
    highlights: ['明清互市古堡', '关城配套遗址', '历史徒步点'],
    scenicName: ''
  },
  {
    id: 3,
    spotName: '📍张家口堡',
    location: '河北省张家口市桥西区堡子里街道鼓楼西街16号',
    images: ['/home/zjkb1.jpg', '/home/zjkb3.jpg', '/home/zjkb2.jpg'],
    detailedIntroduction: '有着“明清建筑博物馆”之称，完整保留古街巷、文昌阁、抡才书院；街巷深处藏有多处晋察冀时期革命旧址，在老院落与市井烟火之中，可以触摸长城脚下厚重的历史与红色记忆，也是本地非遗手作的聚集地。',
    highlights: ['六百年军堡', '老城烟火', '革命旧址集群'],
    scenicName: ''
  },
  {
    id: 4,
    spotName: '📍安家沟生态旅游区',
    location: '河北省张家口市桥西区东窑子镇石匠窑村',
    images: ['/home/anjiaoguotongxue1.jpg', '/home/anjiaoguotongxue3.jpg', '/home/anjiaoguotongxue2.jpg'],
    detailedIntroduction: '坐落于石匠窑村内，峡谷溪流、山林清幽；村内留存察哈尔抗日活动旧址与地道遗迹，现已打造红色研学徒步线路；同时发展山地采摘、农家餐饮，以文旅流量带动村民增收，是长城脚下农旅融合的典型乡村样板。',
    highlights: ['峡谷溪流', '山林清幽', '红色研学徒步', '山地采摘', '农家餐饮'],
    scenicName: ''
  },
  {
    id: 5,
    spotName: '📍清河影视城',
    location: '河北省张家口市桥西区东窑子镇清河村',
    images: ['/home/qingheyingyuan1.jpg', '/home/qingheyingyuan3.jpg', '/home/qingheyingyuan2.jpg'],
    detailedIntroduction: '依托清河村古村落改造，复原民国时期张家口街巷风貌；园区配套智慧农场、海棠采摘园、红色主题影视研学活动；以影视文旅引流，带动返乡创业、农产品外销，探索古村落活化振兴的新路径。',
    highlights: ['老张家口复刻街区', '智慧农场', '红色影视研学'],
    scenicName: ''
  },
]

function ImageCarousel({ images, alt }: { images: string[]; alt: string }) {
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)

  const go = useCallback((dir: number) => {
    setCurrent(prev => {
      const next = prev + dir
      if (next < 0) return images.length - 1
      if (next >= images.length) return 0
      return next
    })
  }, [images.length])

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = startX.current - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      go(diff > 0 ? 1 : -1)
    }
  }

  return (
    <div className="spot-page__image-wrap">
      <div
        className="spot-page__carousel-track"
        ref={trackRef}
        style={{ transform: `translateX(-${current * 100}%)` }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((src, i) => (
          <img key={i} className="spot-page__image" src={src} alt={`${alt} - ${i + 1}`} />
        ))}
      </div>
      <button className="spot-page__carousel-btn spot-page__carousel-btn--prev" onClick={() => go(-1)} aria-label="上一张">
        ‹
      </button>
      <button className="spot-page__carousel-btn spot-page__carousel-btn--next" onClick={() => go(1)} aria-label="下一张">
        ›
      </button>
      <div className="spot-page__carousel-dots">
        {images.map((_, i) => (
          <button
            key={i}
            className={`spot-page__carousel-dot ${i === current ? 'spot-page__carousel-dot--active' : ''}`}
            onClick={() => setCurrent(i)}
            aria-label={`第${i + 1}张`}
          />
        ))}
      </div>
    </div>
  )
}

export function SpotRecommendPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const collectionTitle = searchParams.get('collectionTitle')?.trim()

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

          <div className="spot-page__grid">
            {SPOTS.map((spot) => (
              <article key={spot.id} className="spot-page__card">
                <ImageCarousel images={spot.images} alt={spot.spotName} />
                <div className="spot-page__card-body">
                  <p className="spot-page__scenic-name">{spot.scenicName}</p>
                  <h2>{spot.spotName}</h2>
                  {spot.location && <p className="spot-page__location">{spot.location}</p>}
                  {spot.detailedIntroduction && <p className="spot-page__description">{spot.detailedIntroduction}</p>}
                  {spot.highlights.length > 0 && (
                    <div className="spot-page__highlights">
                      <span className="spot-page__highlights-label"></span>
                      <div className="spot-page__highlights-tags">
                        {spot.highlights.map((h, i) => (
                          <span key={i} className="spot-page__highlight-tag">{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
