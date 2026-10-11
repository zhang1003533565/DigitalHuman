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
    images: ['/home/hero-dajingmen.png', '/home/great_wall_village.jpg', '/home/dajingmen_hongyun.jpg'],
    detailedIntroduction: '作为张家口城市象征，门楣“大好河山”气势雄浑，既是明清长城重要关隘、昔日张库大道的商贸起点，也见证了察哈尔地区近代革命风云；从这里出发，可沿古道深入周边村落，开启长城文化与红色乡土交织的乡野旅程',
    highlights: ['万里长城第一门', '张库大道起点','红色研学原点'],
    scenicName: ''
  },
  {
    id: 2,
    spotName: '📍 来远堡遗址公园',
    location: '张家口市乡村旅游体验区',
    images: ['/home/great_wall_village.jpg', '/home/hero-dajingmen.png', '/home/dajingmen_hongyun.jpg'],
    detailedIntroduction: '走进村落与田园，体验当地的乡村风貌、农事生活和特色物产。沿途可以欣赏自然景观，了解村庄文化，感受乡村休闲旅行的轻松氛围。',
    highlights: ['欣赏田园风光，体验乡村生活，发现当地特色农产品。'],
    scenicName: ''
  },
  {
    id: 3,
    spotName: '古关新韵·长城记忆',
    location: '大境门长城文化旅游带',
    images: ['/home/dajingmen_hongyun.jpg', '/home/hero-dajingmen.png', '/home/great_wall_village.jpg'],
    detailedIntroduction: '以长城和古关为线索，了解张家口的边塞历史与城市记忆。古老建筑与周边街区相映成景，适合慢慢游览、拍照和感受地方文化。',
    highlights: ['近距离感受长城遗迹', '了解边关故事', '拍摄古关与街巷风貌'],
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
