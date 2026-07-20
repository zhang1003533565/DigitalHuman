/* eslint-disable react-hooks/set-state-in-effect -- selected route mirrors asynchronously loaded route options. */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import './RouteRecommendPage.css'
import { loadMapConfig } from '../api/mapConfig'
import { useVisitorTheme } from '../theme/VisitorThemeProvider'
import { createVisitorMapThemeController } from '../theme/visitorMapTheme'
import { readTripPlan, resolveRouteId } from './navigationContext'
import {
  buildRouteRecommendations,
  buildVisitorRouteSummary,
  type Coordinate,
  type RouteFilters,
  type ScenicRoute,
} from './routeRecommendation'

type FilterState = RouteFilters
type FacilityGroup = 'food' | 'wc' | 'service'
type RouteSelectionResolution = {
  visibleRouteIds: string[]
  currentSelectedRouteId: string
  cachedRouteId: string
}

const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]
const FACILITY_GROUP_CATEGORIES: Record<FacilityGroup, string[]> = {
  food: ['food'],
  wc: ['wc'],
  service: ['service', 'transport', 'medical'],
}
const ALL_FACILITY_GROUPS: FacilityGroup[] = ['food', 'wc', 'service']
const FILTER_OPTIONS = {
  interest: ['历史文化', '自然风光', '亲子家庭'],
  duration: ['4', '5', '6'],
  intensity: ['轻松', '舒缓', '深度'],
} as const
const ROUTE_LOAD_ERROR_MESSAGE = '路线加载失败了，筛选已保留，可以重新加载路线后再试。'

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

function getFacilityGroupLabel(group: FacilityGroup) {
  if (group === 'food') return '餐饮'
  if (group === 'wc') return '卫生间'
  return '服务点'
}

function getFacilityLabel(category: string) {
  const labels: Record<string, string> = {
    food: '餐饮',
    wc: '卫生间',
    service: '服务点',
    transport: '交通服务',
    medical: '医疗服务',
  }
  return labels[category] ?? category
}

const reconcileSelectedRouteId = ({
  visibleRouteIds,
  currentSelectedRouteId,
  cachedRouteId,
}: RouteSelectionResolution) => {
  if (currentSelectedRouteId && visibleRouteIds.includes(currentSelectedRouteId)) {
    return currentSelectedRouteId
  }
  if (!visibleRouteIds.length) {
    return currentSelectedRouteId
  }
  if (cachedRouteId && visibleRouteIds.includes(cachedRouteId)) {
    return cachedRouteId
  }
  return visibleRouteIds[0]
}

const createRouteRequestGate = () => {
  let latestRequestId = 0

  return {
    begin() {
      latestRequestId += 1
      return latestRequestId
    },
    isCurrent(requestId: number) {
      return requestId === latestRequestId
    },
  }
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
  const [routeRequestVersion, setRouteRequestVersion] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [mapError, setMapError] = useState<MapLoadError | null>(null)
  const [visibleFacilityGroups, setVisibleFacilityGroups] = useState<FacilityGroup[]>(ALL_FACILITY_GROUPS)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [amapApi, setAmapApi] = useState<any>(null)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeOverlaysRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facilityOverlaysRef = useRef<any[]>([])
  const routeRequestGateRef = useRef(createRouteRequestGate())
  const mapThemeControllerRef = useRef(createVisitorMapThemeController(
    effectiveTheme,
    (error) => console.warn('sync route recommendation map theme failed', error),
  ))

  useLayoutEffect(() => {
    mapThemeControllerRef.current.setTheme(effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    setSelectedRouteId(resolveRouteId(location.search, window.sessionStorage.getItem('digitalhuman.tripPlan')))
  }, [location.search])

  useEffect(() => {
    const controller = new AbortController()

    async function loadRoutes() {
      const requestId = routeRequestGateRef.current.begin()
      setLoadError('')
      try {
        const response = await axios.get<ScenicRoute[]>('/api/user/scenic/routes/recommend', {
          params: filters.interest ? { interest: filters.interest } : {},
          signal: controller.signal,
        })
        if (!routeRequestGateRef.current.isCurrent(requestId)) return
        setRoutes(response.data)
      } catch (error) {
        if (controller.signal.aborted || !routeRequestGateRef.current.isCurrent(requestId)) return
        console.error(error)
        setLoadError(ROUTE_LOAD_ERROR_MESSAGE)
      }
    }

    void loadRoutes()
    return () => {
      controller.abort()
    }
  }, [filters.interest, routeRequestVersion])

  useEffect(() => {
    let cancelled = false
    const mapThemeController = mapThemeControllerRef.current

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
      mapThemeController.detachMap()
      routeOverlaysRef.current = []
      facilityOverlaysRef.current = []
    }
  }, [])

  const filteredRoutes = useMemo(() => routes.filter((route) => {
    const matchesDuration = !filters.duration || route.duration.includes(filters.duration)
    const matchesIntensity = !filters.intensity || route.intensity.includes(filters.intensity)
    return matchesDuration && matchesIntensity
  }), [filters.duration, filters.intensity, routes])

  const recommendedRoutes = useMemo(
    () => buildRouteRecommendations(filteredRoutes, filters, cachedPlan?.route?.id || ''),
    [cachedPlan?.route?.id, filteredRoutes, filters],
  )
  const visibleRoutes = useMemo(() => recommendedRoutes.slice(0, 3), [recommendedRoutes])

  useEffect(() => {
    const nextRouteId = reconcileSelectedRouteId({
      visibleRouteIds: visibleRoutes.map((route) => route.id),
      currentSelectedRouteId: selectedRouteId,
      cachedRouteId: cachedPlan?.route?.id ?? '',
    })
    if (nextRouteId !== selectedRouteId) {
      setSelectedRouteId(nextRouteId)
    }
  }, [cachedPlan?.route?.id, selectedRouteId, visibleRoutes])

  const selectedRoute = useMemo(
    () => visibleRoutes.find((route) => route.id === selectedRouteId) ?? visibleRoutes[0] ?? null,
    [selectedRouteId, visibleRoutes],
  )
  const selectedRouteSummary = useMemo(
    () => (selectedRoute ? buildVisitorRouteSummary(selectedRoute, visibleRoutes.findIndex((route) => route.id === selectedRoute.id)) : null),
    [selectedRoute, visibleRoutes],
  )
  const visibleFacilityGroupSet = useMemo(() => new Set(visibleFacilityGroups), [visibleFacilityGroups])
  const visibleFacilities = useMemo(() => (selectedRoute?.facilities ?? []).filter((facility) => {
    return ALL_FACILITY_GROUPS.some((group) => (
      visibleFacilityGroupSet.has(group) && FACILITY_GROUP_CATEGORIES[group].includes(facility.category)
    ))
  }), [selectedRoute, visibleFacilityGroupSet])

  useEffect(() => {
    if (!amapApi || !selectedRoute || !mapContainerRef.current || mapInstanceRef.current) return

    mapInstanceRef.current = mapThemeControllerRef.current.ensureMap((mapStyle) => new amapApi.Map(mapContainerRef.current, {
      zoom: 14,
      center: LINGSHAN_CENTER,
      viewMode: '2D',
      mapStyle,
    }))

    requestAnimationFrame(() => {
      mapInstanceRef.current?.resize?.()
    })
  }, [amapApi, selectedRoute])

  useEffect(() => {
    mapThemeControllerRef.current.syncMapStyle()
  }, [effectiveTheme])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = amapApi
    if (!map || !AMap) return

    if (routeOverlaysRef.current.length) {
      map.remove?.(routeOverlaysRef.current)
      routeOverlaysRef.current = []
    }
    if (facilityOverlaysRef.current.length) {
      map.remove?.(facilityOverlaysRef.current)
      facilityOverlaysRef.current = []
    }

    if (!selectedRoute) {
      map.setZoomAndCenter?.(14, LINGSHAN_CENTER)
      return
    }

    map.resize?.()

    const routeNodes = selectedRoute.nodes ?? []
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
      routeOverlaysRef.current.push(polyline)
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
      routeOverlaysRef.current.push(marker)
    })

    if (path.length > 1) {
      map.setFitView?.(routeOverlaysRef.current, false, [82, 82, 82, 82], 14)
    } else {
      map.setZoomAndCenter?.(14, LINGSHAN_CENTER)
    }
  }, [amapApi, selectedRoute])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = amapApi
    if (!map || !AMap) return

    if (facilityOverlaysRef.current.length) {
      map.remove?.(facilityOverlaysRef.current)
      facilityOverlaysRef.current = []
    }

    if (!selectedRoute) return

    visibleFacilities.forEach((facility) => {
      const marker = new AMap.Marker({
        position: coordinateToLngLat(facility.coordinate),
        title: facility.name,
        label: {
          content: getFacilityLabel(facility.category),
          direction: 'top',
        },
      })
      map.add(marker)
      facilityOverlaysRef.current.push(marker)
    })
  }, [amapApi, selectedRoute, visibleFacilityGroups, visibleFacilities])

  function handleFilterChange(name: keyof FilterState, value: string) {
    setFilters((current) => ({
      ...current,
      [name]: current[name] === value ? '' : value,
    }))
  }

  function handleFacilityToggle(group: FacilityGroup) {
    setVisibleFacilityGroups((current) => (
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group]
    ))
  }

  function clearFilters() {
    setFilters({ interest: '', duration: '', intensity: '' })
  }

  return (
    <main className="page-shell route-page">
      <div className="route-page__inner">
        <section className="route-hero hero-panel">
          <div className="route-hero__copy">
            <p className="surface-tag">Route</p>
            <h1>今天想怎么玩？</h1>
            <p className="route-hero__text">先选偏好，再比较三条路线，确认后直接查看地图和行程安排。</p>
          </div>

          <div className="route-filter-panel">
            <div className="route-filter-groups" aria-label="路线筛选">
              <fieldset className="route-filter-group">
                <legend>兴趣偏好</legend>
                <div className="route-chip-list">
                  {FILTER_OPTIONS.interest.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`route-chip${filters.interest === option ? ' route-chip--active' : ''}`}
                      aria-pressed={filters.interest === option}
                      onClick={() => handleFilterChange('interest', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="route-filter-group">
                <legend>游玩时长</legend>
                <div className="route-chip-list">
                  {FILTER_OPTIONS.duration.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`route-chip${filters.duration === option ? ' route-chip--active' : ''}`}
                      aria-pressed={filters.duration === option}
                      onClick={() => handleFilterChange('duration', option)}
                    >
                      {option}小时
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="route-filter-group">
                <legend>步行强度</legend>
                <div className="route-chip-list">
                  {FILTER_OPTIONS.intensity.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`route-chip${filters.intensity === option ? ' route-chip--active' : ''}`}
                      aria-pressed={filters.intensity === option}
                      onClick={() => handleFilterChange('intensity', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="route-filter-panel__footer">
              <p>已筛出 {visibleRoutes.length} 条可直接比较的路线。</p>
              <button type="button" className="ghost-button route-reset-button" onClick={clearFilters}>清除筛选</button>
            </div>

            {loadError ? (
              <div className="route-status route-status--error" role="status" aria-live="polite">
                <span>{loadError}</span>
                <button
                  type="button"
                  className="ghost-button route-reload-button"
                  onClick={() => {
                    setLoadError('')
                    setRouteRequestVersion((current) => current + 1)
                  }}
                >
                  重新加载路线
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {visibleRoutes.length ? (
          <section className="route-choices" aria-label="路线选择">
            {visibleRoutes.map((route, index) => {
              const summary = buildVisitorRouteSummary(route, index)
              return (
                <button
                  key={route.id}
                  type="button"
                  className={`route-choice-card${selectedRoute?.id === route.id ? ' route-choice-card--active' : ''}`}
                  aria-pressed={selectedRoute?.id === route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                >
                  <span className="route-choice-card__badge">{summary.badge}</span>
                  <span className="route-choice-card__title">{route.name}</span>
                  <span className="route-choice-card__audience">{summary.audience}</span>
                  <span className="route-choice-card__description">{summary.description}</span>
                  <span className="route-choice-card__stats">
                    <span>{route.duration}</span>
                    <span>{route.distance}</span>
                    <span>{route.intensity}</span>
                  </span>
                  <span className="route-choice-card__stops">
                    {(summary.majorStops.length ? summary.majorStops : ['沿主游线灵活安排']).slice(0, 3).join(' · ')}
                  </span>
                  <span className="route-choice-card__action">查看行程</span>
                </button>
              )
            })}
          </section>
        ) : (
          <section className="route-empty-state" aria-live="polite">
            <h2>暂时没有符合条件的路线</h2>
            <p>可以放宽筛选条件后重新比较，我们会保留当前页位置。</p>
            <button type="button" className="ghost-button route-reset-button" onClick={clearFilters}>清除筛选</button>
          </section>
        )}

        {selectedRoute && selectedRouteSummary ? (
          <section className="route-trip" aria-labelledby="selected-route-title">
            <header className="route-trip__header">
              <div className="route-trip__title-block">
                <p className="surface-tag">{selectedRouteSummary.badge}</p>
                <h2 id="selected-route-title">{selectedRoute.name}</h2>
                <p className="route-trip__tip">{selectedRouteSummary.travelTip}</p>
              </div>

              <div className="route-trip__facts" aria-label="路线信息">
                <span><strong>{selectedRoute.duration}</strong><small>预计时长</small></span>
                <span><strong>{selectedRoute.distance}</strong><small>步行距离</small></span>
                <span><strong>{selectedRoute.intensity}</strong><small>步行强度</small></span>
                <span><strong>{selectedRoute.bestTime}</strong><small>最佳时间</small></span>
              </div>
            </header>

            <div className="route-trip__layout">
              <section className="route-map-panel" aria-label="路线地图">
                <div className="route-facility-controls" aria-label="沿途设施显示">
                  {ALL_FACILITY_GROUPS.map((group) => (
                    <button
                      key={group}
                      type="button"
                      className={`route-facility-toggle${visibleFacilityGroupSet.has(group) ? ' route-facility-toggle--active' : ''}`}
                      aria-pressed={visibleFacilityGroupSet.has(group)}
                      onClick={() => handleFacilityToggle(group)}
                    >
                      {getFacilityGroupLabel(group)}
                    </button>
                  ))}
                </div>

                <div className="route-map-panel__frame">
                  <div ref={mapContainerRef} className="route-map-panel__canvas" />
                  <div className="route-map-fallback">
                    <strong>{selectedRoute.name}</strong>
                    <span>{mapError?.message || '高德地图加载中，先查看下方行程安排。'}</span>
                    <div className="route-map-schematic" aria-label="路线示意">
                      {(selectedRoute.nodes ?? []).slice(0, 6).map((node, index) => (
                        <span key={node.id}>
                          <b>{index + 1}</b>
                          {node.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="route-map-panel__footer">
                  <div className="route-facility-summary">
                    {visibleFacilities.length ? visibleFacilities.slice(0, 4).map((facility) => (
                      <span key={facility.id}>{getFacilityLabel(facility.category)} · {facility.name}</span>
                    )) : <span>当前未显示设施点，仍可查看路线轨迹与节点顺序。</span>}
                  </div>
                  <button
                    type="button"
                    className="route-map-link"
                    onClick={() => navigate(`/map?routeId=${encodeURIComponent(selectedRoute.id)}`)}
                  >
                    在景区地图中打开
                  </button>
                </div>
              </section>

              <section className="route-itinerary" aria-label="行程安排">
                <h3>行程安排</h3>
                <div className="route-itinerary__list">
                  {(selectedRoute.nodes ?? []).map((node, index) => (
                    <article key={node.id} className="route-stop">
                      <span className="route-stop__index">{index + 1}</span>
                      <div className="route-stop__content">
                        <h4>{node.name}</h4>
                        <p>{node.summary}</p>
                        <span>{node.required ? `建议停留 · ${node.stay}` : node.stay}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
