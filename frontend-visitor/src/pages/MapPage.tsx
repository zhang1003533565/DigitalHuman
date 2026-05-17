import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import '../App.css'
import './MapPage.css'
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

const AMAP_KEY = '5b01b946c26d0f94f7d2ddb9d09ff26f'
const AMAP_SECURITY_KEY = '692196a068ef6c9cad53a55fc9e47ad7'
// 灵山胜境景区中心坐标 [lng, lat]
const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]
// 景区边界：西南角、东北角
const LINGSHAN_SW: [number, number] = [120.09, 31.41]
const LINGSHAN_NE: [number, number] = [120.115, 31.44]

declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AMap?: any
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let amapLoaderPromise: Promise<any> | null = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadAMap(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapLoaderPromise) return amapLoaderPromise

  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY }
  amapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`
    script.async = true
    script.onload = () => resolve(window.AMap)
    script.onerror = (err) => {
      amapLoaderPromise = null
      reject(err)
    }
    document.head.appendChild(script)
  })
  return amapLoaderPromise
}

type Category = {
  key: string
  label: string
  icon: string
}

const CATEGORIES: Category[] = [
  { key: 'all', label: '全部', icon: '▦' },
  { key: 'spot', label: '景点', icon: '◉' },
  { key: 'service', label: '服务', icon: '☂' },
  { key: 'culture', label: '文化', icon: '▤' },
  { key: 'food', label: '餐饮', icon: '☕' },
  { key: 'wc', label: '卫生间', icon: '♨' },
  { key: 'parking', label: '停车场', icon: 'P' },
]

export function MapPage({ onLogout }: Props) {
  const [spots, setSpots] = useState<ScenicSpot[]>([])
  const [activeCategory, setActiveCategory] = useState('all')
  const [keyword, setKeyword] = useState('')
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)

  useEffect(() => {
    async function loadSpots() {
      try {
        const response = await axios.get<ScenicSpot[]>('/api/scenic/spots')
        setSpots(response.data)
      } catch (err) {
        console.warn('load spots failed', err)
      }
    }

    void loadSpots()
  }, [])

  useEffect(() => {
    let cancelled = false
    loadAMap()
      .then((AMap) => {
        if (cancelled || !mapContainerRef.current) return
        const sw = new AMap.LngLat(LINGSHAN_SW[0], LINGSHAN_SW[1])
        const ne = new AMap.LngLat(LINGSHAN_NE[0], LINGSHAN_NE[1])
        const bounds = new AMap.Bounds(sw, ne)

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
          center: LINGSHAN_CENTER,
          viewMode: '2D',
          zooms: [14, 19],
        })
        mapInstanceRef.current = map

        map.setBounds(bounds)
        map.setLimitBounds(bounds)

        new AMap.Marker({
          position: LINGSHAN_CENTER,
          title: '灵山胜境',
          map,
        })
      })
      .catch((err) => {
        console.error('AMap load failed', err)
      })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy?.()
        mapInstanceRef.current = null
      }
    }
  }, [])

  const handleZoom = (delta: number) => {
    const map = mapInstanceRef.current
    if (!map) return
    const next = (map.getZoom?.() ?? 15) + delta
    map.setZoom?.(next)
  }

  const handleLocate = () => {
    mapInstanceRef.current?.setCenter?.(LINGSHAN_CENTER)
  }

  // 保留 spots 状态以供后续插针使用
  void spots

  return (
    <main className="page-shell">
      <AppTopNav onLogout={onLogout} />

      <section className="page-content">
        <div className="map-page">
          {/* 左侧：地图区域 */}
          <div className="map-page__main">
            <div ref={mapContainerRef} className="map-page__canvas" />

            {/* 分类竖向侧边栏 */}
            <aside className="map-sidebar" aria-label="分类筛选">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  type="button"
                  className={`map-sidebar__item${
                    activeCategory === cat.key ? ' map-sidebar__item--active' : ''
                  }`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  <span className="map-sidebar__icon" aria-hidden>
                    {cat.icon}
                  </span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </aside>

            {/* 顶部搜索框 */}
            <div className="map-search">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索景点、服务、路线"
              />
              <button type="button" className="map-search__btn" aria-label="搜索">
                🔍
              </button>
            </div>

            {/* 推荐路线浮卡 */}
            <div className="map-route-card">
              <div className="map-route-card__head">
                <span>推荐路线</span>
                <button type="button" className="map-route-card__more">
                  更多路线 ›
                </button>
              </div>
              <div className="map-route-card__body">
                <div className="map-route-card__title">
                  文化经典线
                  <span className="map-route-card__pill">推荐</span>
                </div>
                <p className="map-route-card__desc">探寻佛教文化精髓，感受灵山人文底蕴</p>
                <div className="map-route-card__meta">
                  <span>⏱ 约2.5小时</span>
                  <span>📍 约3.8公里</span>
                </div>
                <div className="map-route-card__chain">
                  <span>景区入口</span>
                  <em>›</em>
                  <span>大照壁</span>
                  <em>›</em>
                  <span>五明桥</span>
                  <em>›</em>
                  <span>灵山大佛</span>
                </div>
                <button type="button" className="map-route-card__cta">
                  查看路线详情 →
                </button>
              </div>
            </div>

            {/* 右侧浮动控件 */}
            <div className="map-controls">
              <div className="map-compass" aria-hidden>
                <span>N</span>
              </div>
              <div className="map-ctrl-group">
                <button
                  type="button"
                  className="map-ctrl-btn"
                  onClick={handleLocate}
                  aria-label="定位"
                >
                  ◎
                  <small>定位</small>
                </button>
              </div>
              <div className="map-ctrl-group">
                <button
                  type="button"
                  className="map-ctrl-btn"
                  onClick={() => handleZoom(1)}
                  aria-label="放大"
                >
                  +
                </button>
                <button
                  type="button"
                  className="map-ctrl-btn"
                  onClick={() => handleZoom(-1)}
                  aria-label="缩小"
                >
                  −
                </button>
              </div>
            </div>

            <div className="map-scale">200米</div>

            {/* 底部操作栏 */}
            <div className="map-actions">
              <button type="button" onClick={handleLocate}>
                📍 当前位置
              </button>
              <button type="button" onClick={() => handleZoom(1)}>
                ⊕ 放大
              </button>
              <button type="button" onClick={() => handleZoom(-1)}>
                ⊖ 缩小
              </button>
              <button type="button">🛰 全景视图</button>
              <button type="button">📖 图例</button>
            </div>
          </div>

          {/* 右侧：信息卡片列 */}
          <aside className="map-side">
            {/* AI 数字人直播 */}
            <div className="side-card live-card">
              <div className="side-card__head">
                <h3>AI数字人直播</h3>
                <span className="side-card__status">在线 🔊</span>
              </div>
              <div className="live-card__chat">
                <div className="live-card__msg">
                  <span className="live-card__msg-tag live-card__msg-tag--cyan">灵</span>
                  <b>灵灵：</b>洗心池有什么特别？
                </div>
                <div className="live-card__msg">
                  <span className="live-card__msg-tag live-card__msg-tag--gold">灵</span>
                  <b>灵灵：</b>灵山大佛多高呀？
                </div>
                <div className="live-card__msg">
                  <span className="live-card__msg-tag live-card__msg-tag--cyan">灵</span>
                  <b>灵灵：</b>想了解附近的吃饭…
                </div>
              </div>
              <div className="live-card__actions">
                <button type="button" className="live-card__btn live-card__btn--primary">
                  🎬 进入直播间
                </button>
                <button type="button" className="live-card__btn live-card__btn--ghost">
                  🎙 语音互动
                </button>
              </div>
            </div>

            {/* 附近服务 */}
            <div className="side-card">
              <div className="side-card__head">
                <h3>附近服务</h3>
                <button type="button" className="map-route-card__more">查看更多 ›</button>
              </div>
              <div className="nearby__grid nearby__grid--3">
                <div className="nearby__item">
                  <div className="nearby__icon nearby__icon--blue">P</div>
                  <span>停车场</span>
                </div>
                <div className="nearby__item">
                  <div className="nearby__icon nearby__icon--cyan">♨</div>
                  <span>卫生间</span>
                </div>
                <div className="nearby__item">
                  <div className="nearby__icon nearby__icon--orange">☕</div>
                  <span>餐饮</span>
                </div>
                <div className="nearby__item">
                  <div className="nearby__icon nearby__icon--purple">☻</div>
                  <span>游客中心</span>
                </div>
                <div className="nearby__item">
                  <div className="nearby__icon nearby__icon--green">🚌</div>
                  <span>接驳车</span>
                </div>
                <div className="nearby__item">
                  <div className="nearby__icon nearby__icon--red">＋</div>
                  <span>医务点</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
