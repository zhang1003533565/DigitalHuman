/* eslint-disable react-hooks/set-state-in-effect -- selected route mirrors asynchronously loaded route options. */
import { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import './RouteRecommendPage.css'
import { loadMapConfig } from '../api/mapConfig'
import { useVisitorTheme } from '../theme/VisitorThemeProvider'
import { getVisitorMapStyle } from '../theme/visitorMapTheme'
import { readTripPlan, resolveRouteId } from './navigationContext'
import {
  buildRouteRecommendations,
  type Coordinate,
  type RouteFilters,
  type ScenicRoute,
} from './routeRecommendation'

type FilterState = RouteFilters

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
type MapLoadError = { code: 'configMissing' | 'sdkLoadError'; message: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadAMap(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const mapConfig = await loadMapConfig()
  if (!mapConfig.configured || !mapConfig.amapKey || !mapConfig.amapSecurityKey) {
    return Promise.reject({ code: 'configMissing', message: '地图服务未配置，请联系管理员' } satisfies MapLoadError)
  }
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapLoaderPromise) return amapLoaderPromise

  window._AMapSecurityConfig = { securityJsCode: mapConfig.amapSecurityKey }
  amapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${mapConfig.amapKey}`
    script.async = true
    script.onload = () => resolve(window.AMap)
    script.onerror = () => {
      amapLoaderPromise = null
      reject({ code: 'sdkLoadError', message: '地图加载失败，请稍后重试' } satisfies MapLoadError)
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

export function RouteRecommendPage() {
  const { effectiveTheme } = useVisitorTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const cachedPlan = useMemo(() => readTripPlan(window.sessionStorage.getItem('digitalhuman.tripPlan')), [])
  const [filters, setFilters] = useState<FilterState>({
    interest: '',
    duration: '',
    intensity: '',
  })
  const [routes, setRoutes] = useState<ScenicRoute[]>([])
  const [selectedRouteId, setSelectedRouteId] = useState(() => resolveRouteId(
    location.search,
    window.sessionStorage.getItem('digitalhuman.tripPlan'),
  ))
  const [loadError, setLoadError] = useState('')
  const [mapError, setMapError] = useState<MapLoadError | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [amapApi, setAmapApi] = useState<any>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapOverlaysRef = useRef<any[]>([])

  useEffect(() => {
    setSelectedRouteId(resolveRouteId(location.search, window.sessionStorage.getItem('digitalhuman.tripPlan')))
  }, [location.search])

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
          const cachedId = cachedPlan?.route?.id ?? ''
          return response.data.some((route) => route.id === cachedId) ? cachedId : response.data[0]?.id ?? ''
        })
      } catch (error) {
        console.error(error)
        setLoadError('路线数据加载失败，请确认后端服务已启动。')
      }
    }

    void loadRoutes()
  }, [cachedPlan?.route?.id, filters.interest])

  useEffect(() => {
    let cancelled = false

    loadAMap()
      .then((AMap) => {
        if (cancelled) return
        setMapError(null)
        setAmapApi(AMap)
      })
      .catch((error) => {
        console.error('AMap load failed', error)
        if (!cancelled) {
          setMapError(error && typeof error === 'object' && 'code' in error
            ? error as MapLoadError
            : { code: 'sdkLoadError', message: '地图加载失败，请稍后重试' })
        }
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

  const recommendedRoutes = useMemo(
    () => buildRouteRecommendations(filteredRoutes, filters, cachedPlan?.route?.id || ''),
    [cachedPlan?.route?.id, filteredRoutes, filters],
  )

  const selectedRoute = useMemo(
    () => recommendedRoutes.find((route) => route.id === selectedRouteId) ?? recommendedRoutes[0] ?? null,
    [recommendedRoutes, selectedRouteId],
  )

  useEffect(() => {
    if (!selectedRoute && recommendedRoutes[0]) {
      setSelectedRouteId(recommendedRoutes[0].id)
    }
  }, [recommendedRoutes, selectedRoute])

  useEffect(() => {
    if (!amapApi || !selectedRoute || !mapContainerRef.current || mapInstanceRef.current) return

    mapInstanceRef.current = new amapApi.Map(mapContainerRef.current, {
      zoom: 14,
      center: LINGSHAN_CENTER,
      viewMode: '2D',
      mapStyle: getVisitorMapStyle(effectiveTheme),
    })

    requestAnimationFrame(() => {
      mapInstanceRef.current?.resize?.()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- theme changes must not recreate the existing map instance.
  }, [amapApi, selectedRoute])

  useEffect(() => {
    try {
      mapInstanceRef.current?.setMapStyle?.(getVisitorMapStyle(effectiveTheme))
    } catch (error) {
      console.warn('sync route recommendation map theme failed', error)
    }
  }, [effectiveTheme])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = amapApi
    if (!map || !AMap) return

    if (mapOverlaysRef.current.length) {
      map.remove?.(mapOverlaysRef.current)
      mapOverlaysRef.current = []
    }

    if (!selectedRoute) {
      map.setZoomAndCenter?.(14, LINGSHAN_CENTER)
      return
    }

    map.resize?.()

    const routeNodes = selectedRoute.nodes ?? []
    const routeFacilities = selectedRoute.facilities ?? []
    const routePolyline = selectedRoute.polyline ?? []
    const path = (routePolyline.length ? routePolyline : routeNodes.map((node) => node.coordinate))
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

    routeNodes.forEach((node, index) => {
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

    routeFacilities.forEach((facility) => {
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
      map.setFitView?.(mapOverlaysRef.current, false, [82, 82, 82, 82], 14)
    } else {
      map.setZoomAndCenter?.(14, LINGSHAN_CENTER)
    }
  }, [amapApi, selectedRoute])

  return (
    <main className="page-shell route-shell">
      <section className="route-planner">
        <aside className="route-planner__panel">
          <header className="route-planner__heading">
            <p className="surface-tag">Route Planner</p>
            <h1>路线推荐</h1>
            <p>
              先选择你的游玩偏好，系统会按匹配度给出推荐路线和清楚的取舍说明。
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
            <div className="route-list__header">
              <span>为你推荐</span>
              <strong>{recommendedRoutes.length} 条路线</strong>
            </div>
            {recommendedRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                className={`route-card${selectedRoute?.id === route.id ? ' route-card--active' : ''}`}
                onClick={() => setSelectedRouteId(route.id)}
              >
                <span className="route-card__meta">
                  <b>{route.rankLabel}</b>
                  <i>{route.score} 分匹配</i>
                </span>
                <strong>{route.name}</strong>
                <span className="route-card__reason">{route.matchReason}</span>
                <span className="route-card__tradeoff">取舍：{route.tradeoff}</span>
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
              <header className="route-decision">
                <div className="route-decision__copy">
                  <p className="surface-tag">{selectedRoute.rankLabel} · {selectedRoute.score} 分匹配</p>
                  <h2>{selectedRoute.name}</h2>
                  <p><strong>推荐理由：</strong>{selectedRoute.matchReason}</p>
                  <p><strong>选择取舍：</strong>{selectedRoute.tradeoff}</p>
                </div>
                <div className="route-decision__facts" aria-label="路线关键指标">
                  <span><b>{selectedRoute.duration}</b><small>预计时长</small></span>
                  <span><b>{selectedRoute.distance}</b><small>步行距离</small></span>
                  <span><b>{selectedRoute.intensity}</b><small>强度</small></span>
                  <span><b>{selectedRoute.bestTime}</b><small>建议开始</small></span>
                </div>
                <button
                  type="button"
                  className="route-detail__map-link"
                  onClick={() => navigate(`/map?routeId=${encodeURIComponent(selectedRoute.id)}`)}
                >
                  在景区地图中查看
                </button>
              </header>

              <div className="route-detail__content">
                <div className="route-detail__primary">
                  <section className="route-detail__summary" aria-labelledby="route-highlights-title">
                    <p className="surface-tag">Route Value</p>
                    <h3 id="route-highlights-title">路线亮点</h3>
                    <ul className="route-highlights">
                      {selectedRoute.highlights.map((highlight) => (
                        <li key={highlight}>{highlight}</li>
                      ))}
                    </ul>
                    <div className="tag-group">
                      {(selectedRoute.tags ?? []).map((tag) => (
                        <span key={tag} className="info-tag">{tag}</span>
                      ))}
                    </div>
                    {cachedPlan?.route?.id === selectedRoute.id ? (
                      <p className="route-detail__saved">已恢复你刚刚保存的行程规划</p>
                    ) : null}
                  </section>

                  <section className="route-timeline" aria-label="路线节点">
                    {(selectedRoute.nodes ?? []).map((node, index) => (
                      <article key={node.id} className="route-node">
                        <span className="route-node__index">{index + 1}</span>
                        <div>
                          <h3>{node.name}</h3>
                          <p>{node.summary}</p>
                          <span>{node.stay} · {node.required ? '必经节点' : '可选节点'}</span>
                        </div>
                      </article>
                    ))}
                  </section>
                </div>

                <aside className="route-detail__support">
                  <div className="route-detail__map">
                    <div ref={mapContainerRef} className="route-detail__map-canvas" />
                    <div className="route-map-fallback">
                      <strong>{selectedRoute.name}</strong>
                      <span>{mapError?.message || '高德地图加载中，先查看路线节点顺序'}</span>
                      <div className="route-map-schematic" aria-label="路线示意">
                        {(selectedRoute.nodes ?? []).slice(0, 6).map((node, index) => (
                          <span key={node.id}>
                            <b>{index + 1}</b>
                            {node.name}
                          </span>
                        ))}
                      </div>
                      {mapError?.code === 'sdkLoadError' ? (
                        <button type="button" onClick={() => window.location.reload()}>重新加载</button>
                      ) : null}
                    </div>
                  </div>

                  <section className="route-facilities">
                    <h3>沿途服务</h3>
                    {(selectedRoute.facilities ?? []).map((facility) => (
                      <div key={facility.id} className="route-facility">
                        <span>{getFacilityLabel(facility.category)}</span>
                        <strong>{facility.name}</strong>
                        <small>{facility.nearNode} · {facility.distance}</small>
                      </div>
                    ))}
                  </section>
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
