import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import './RouteRecommendPage.css'
import { AppTopNav } from '../components/AppTopNav'

type Props = {
  onLogout: () => void
}

type Coordinate = {
  longitude: number
  latitude: number
}

type RouteNode = {
  id: string
  name: string
  type: string
  stay: string
  summary: string
  required: boolean
  coordinate: Coordinate
}

type RouteFacility = {
  id: string
  name: string
  category: string
  nearNode: string
  distance: string
  coordinate: Coordinate
}

type ScenicRoute = {
  id: string
  name: string
  suitableFor: string
  duration: string
  distance: string
  intensity: string
  reason: string
  bestTime: string
  tags: string[]
  spots: string[]
  nodes: RouteNode[]
  facilities: RouteFacility[]
  polyline: Coordinate[]
}

type FilterState = {
  interest: string
  duration: string
  intensity: string
}

const AMAP_KEY = '5b01b946c26d0f94f7d2ddb9d09ff26f'
const AMAP_SECURITY_KEY = '692196a068ef6c9cad53a55fc9e47ad7'
const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]

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

function coordinateToLngLat(coordinate: Coordinate): [number, number] {
  return [coordinate.longitude, coordinate.latitude]
}

function getFacilityLabel(category: string) {
  const labels: Record<string, string> = {
    food: '餐饮',
    wc: '卫生间',
    service: '服务',
    transport: '交通',
    medical: '医务',
  }
  return labels[category] ?? category
}

function getRouteScore(route: ScenicRoute) {
  if (route.suitableFor.includes('亲子')) return '亲子友好'
  if (route.suitableFor.includes('自然')) return '舒缓观景'
  return '文化深游'
}

export function RouteRecommendPage({ onLogout }: Props) {
  const [filters, setFilters] = useState<FilterState>({
    interest: '',
    duration: '',
    intensity: '',
  })
  const [routes, setRoutes] = useState<ScenicRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [loadError, setLoadError] = useState('')
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapOverlaysRef = useRef<any[]>([])

  useEffect(() => {
    async function loadRoutes() {
      setLoadError('')
      try {
        const response = await axios.get<ScenicRoute[]>('/api/user/scenic/routes/recommend', {
          params: filters.interest ? { interest: filters.interest } : {},
        })
        setRoutes(response.data)
        setSelectedRouteId((current) => {
          if (current && response.data.some((route) => route.id === current)) {
            return current
          }
          return response.data[0]?.id ?? ''
        })
      } catch (error) {
        console.error(error)
        setLoadError('路线数据加载失败，请确认后端服务已启动。')
      }
    }

    void loadRoutes()
  }, [filters.interest])

  useEffect(() => {
    let cancelled = false

    loadAMap()
      .then((AMap) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return

        mapInstanceRef.current = new AMap.Map(mapContainerRef.current, {
          zoom: 16,
          center: LINGSHAN_CENTER,
          viewMode: '2D',
          mapStyle: 'amap://styles/normal',
        })
      })
      .catch((error) => {
        console.error('AMap load failed', error)
      })

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy?.()
        mapInstanceRef.current = null
      }
      mapOverlaysRef.current = []
    }
  }, [])

  const filteredRoutes = useMemo(() => {
    return routes.filter((route) => {
      const matchesDuration = !filters.duration || route.duration.includes(filters.duration)
      const matchesIntensity = !filters.intensity || route.intensity.includes(filters.intensity)
      return matchesDuration && matchesIntensity
    })
  }, [filters.duration, filters.intensity, routes])

  const selectedRoute = useMemo(
    () => filteredRoutes.find((route) => route.id === selectedRouteId) ?? filteredRoutes[0] ?? null,
    [filteredRoutes, selectedRouteId],
  )

  useEffect(() => {
    if (!selectedRoute && filteredRoutes[0]) {
      setSelectedRouteId(filteredRoutes[0].id)
    }
  }, [filteredRoutes, selectedRoute])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = window.AMap
    if (!map || !AMap || !selectedRoute) return

    if (mapOverlaysRef.current.length) {
      map.remove?.(mapOverlaysRef.current)
      mapOverlaysRef.current = []
    }

    const path = (selectedRoute.polyline.length ? selectedRoute.polyline : selectedRoute.nodes.map((node) => node.coordinate))
      .map(coordinateToLngLat)

    if (path.length > 1) {
      const polyline = new AMap.Polyline({
        path,
        strokeColor: '#36b8ff',
        strokeWeight: 7,
        strokeOpacity: 0.9,
        lineJoin: 'round',
        lineCap: 'round',
      })
      map.add(polyline)
      mapOverlaysRef.current.push(polyline)
    }

    selectedRoute.nodes.forEach((node, index) => {
      const marker = new AMap.Marker({
        position: coordinateToLngLat(node.coordinate),
        title: node.name,
        label: {
          content: `${index + 1}`,
          direction: 'center',
        },
      })
      map.add(marker)
      mapOverlaysRef.current.push(marker)
    })

    selectedRoute.facilities.forEach((facility) => {
      const marker = new AMap.Marker({
        position: coordinateToLngLat(facility.coordinate),
        title: facility.name,
        label: {
          content: getFacilityLabel(facility.category),
          direction: 'top',
        },
      })
      map.add(marker)
      mapOverlaysRef.current.push(marker)
    })

    if (path.length > 1) {
      map.setFitView?.(mapOverlaysRef.current, false, [42, 42, 42, 42])
    } else {
      map.setCenter?.(LINGSHAN_CENTER)
    }
  }, [selectedRoute])

  return (
    <main className="page-shell route-shell">
      <AppTopNav onLogout={onLogout} />
      <section className="route-planner">
        <aside className="route-planner__panel">
          <header className="route-planner__heading">
            <p className="surface-tag">Route Planner</p>
            <h1>路线推荐</h1>
            <p>
              基于官方游览路线、景点节点和沿途设施，为游客推荐可执行的景区行程。
            </p>
          </header>

          <section className="route-filter" aria-label="路线筛选">
            <label>
              <span>兴趣偏好</span>
              <select
                value={filters.interest}
                onChange={(event) => setFilters((current) => ({ ...current, interest: event.target.value }))}
              >
                <option value="">全部主题</option>
                <option value="历史文化">历史文化</option>
                <option value="自然风光">自然风光</option>
                <option value="亲子家庭">亲子家庭</option>
              </select>
            </label>
            <label>
              <span>游玩时长</span>
              <select
                value={filters.duration}
                onChange={(event) => setFilters((current) => ({ ...current, duration: event.target.value }))}
              >
                <option value="">不限</option>
                <option value="4">4小时</option>
                <option value="5">5小时</option>
                <option value="6">6小时</option>
              </select>
            </label>
            <label>
              <span>步行强度</span>
              <select
                value={filters.intensity}
                onChange={(event) => setFilters((current) => ({ ...current, intensity: event.target.value }))}
              >
                <option value="">不限</option>
                <option value="轻松">轻松</option>
                <option value="舒缓">舒缓</option>
                <option value="深度">深度</option>
              </select>
            </label>
          </section>

          {loadError ? <p className="route-error">{loadError}</p> : null}

          <section className="route-list" aria-label="推荐路线">
            {filteredRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                className={`route-card${selectedRoute?.id === route.id ? ' route-card--active' : ''}`}
                onClick={() => setSelectedRouteId(route.id)}
              >
                <span className="route-card__meta">{route.suitableFor} · {getRouteScore(route)}</span>
                <strong>{route.name}</strong>
                <span className="route-card__reason">{route.reason}</span>
                <span className="route-card__stats">
                  <b>{route.duration}</b>
                  <b>{route.distance}</b>
                  <b>{route.intensity}</b>
                </span>
              </button>
            ))}
          </section>
        </aside>

        <section className="route-detail" aria-label="路线详情">
          {selectedRoute ? (
            <>
              <div className="route-detail__map">
                <div ref={mapContainerRef} className="route-detail__map-canvas" />
                <div className="route-map-fallback">
                  <strong>{selectedRoute.name}</strong>
                  <span>高德地图加载中，路线节点已就绪</span>
                </div>
              </div>

              <div className="route-detail__content">
                <div className="route-detail__summary">
                  <p className="surface-tag">Selected Route</p>
                  <h2>{selectedRoute.name}</h2>
                  <p>{selectedRoute.reason}</p>
                  <div className="route-detail__chips">
                    <span>{selectedRoute.duration}</span>
                    <span>{selectedRoute.distance}</span>
                    <span>{selectedRoute.intensity}</span>
                    <span>{selectedRoute.bestTime}</span>
                  </div>
                  <div className="tag-group">
                    {selectedRoute.tags.map((tag) => (
                      <span key={tag} className="info-tag">{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="route-timeline">
                  {selectedRoute.nodes.map((node, index) => (
                    <article key={node.id} className="route-node">
                      <span className="route-node__index">{index + 1}</span>
                      <div>
                        <h3>{node.name}</h3>
                        <p>{node.summary}</p>
                        <span>{node.stay} · {node.required ? '必经节点' : '可选节点'}</span>
                      </div>
                    </article>
                  ))}
                </div>

                <aside className="route-facilities">
                  <h3>沿途服务</h3>
                  {selectedRoute.facilities.map((facility) => (
                    <div key={facility.id} className="route-facility">
                      <span>{getFacilityLabel(facility.category)}</span>
                      <strong>{facility.name}</strong>
                      <small>{facility.nearNode} · {facility.distance}</small>
                    </div>
                  ))}
                </aside>
              </div>
            </>
          ) : (
            <div className="route-empty">暂无符合条件的路线</div>
          )}
        </section>
      </section>
    </main>
  )
}
