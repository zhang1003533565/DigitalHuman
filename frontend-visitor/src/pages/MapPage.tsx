/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect -- AMap SDK is untyped and this legacy page synchronizes imperative map state in effects. */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import './MapPage.css'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import { parseNavigationContext } from './navigationContext'
import { loadMapConfig } from '../api/mapConfig'
import {
  createMobileMapSearchDerivedSelection,
  createMobileMapSearchGenerationGate,
  shouldShowMobileMapClearAction,
} from '../map/mobileMapWorkbench'

type ScenicSpot = {
  id: string
  area: string
  name: string
  description: string
  openHours: string
  tags: string[]
}

type ScenicFacility = {
  id: number
  name: string
  categoryId: number
  categoryName: string
  longitude: number
  latitude: number
  image?: string | null
  openTime?: string | null
  closeTime?: string | null
}

type ScenicCategory = {
  id: number
  name: string
  sortOrder: number
  mapVisible?: boolean
}

type SidebarCategory = {
  key: string
  label: string
  icon: string
  categoryId?: number
  count?: number
  isMore?: boolean
}

type CardPosition = {
  left: number
  top: number
}

type RouteCoordinate = { longitude: number; latitude: number }
type MapRoute = { id: string; name: string; polyline?: RouteCoordinate[]; nodes?: Array<{ coordinate: RouteCoordinate }> }

const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]
const CARD_WIDTH = 260
const CARD_HEIGHT = 228
const CARD_GAP_X = 18
const CARD_GAP_Y = 12
const MAX_SIDEBAR_BUTTONS = 7
const FIXED_SIDEBAR_BUTTONS = 1
const MORE_BUTTON_SLOTS = 1
const CATEGORY_ICONS = ['◆', '✦', '◉', '✸', '⌘', 'P', '▲', '■', '✿', '◎']
declare global {
  interface Window {
    _AMapSecurityConfig?: { securityJsCode: string }
    AMap?: any
  }
}

let amapLoaderPromise: Promise<any> | null = null
type MapLoadError = { code: 'configMissing' | 'sdkLoadError'; message: string }

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

function formatOpenHours(openTime?: string | null, closeTime?: string | null) {
  if (!openTime && !closeTime) {
    return '暂无'
  }

  return `${openTime ?? '--:--:--'} - ${closeTime ?? '--:--:--'}`
}

function buildMarkerContent(kind: 'facility' | 'center' | 'search') {
  if (kind === 'facility') {
    return `
      <div style="position:relative;width:30px;height:40px;display:flex;align-items:flex-start;justify-content:center;">
        <div style="width:24px;height:24px;border-radius:50% 50% 50% 8%;transform:rotate(-45deg);background:linear-gradient(135deg,#4ed7ff,#1f7aff);border:3px solid #ffffff;box-shadow:0 10px 24px rgba(31,122,255,0.45);position:relative;">
          <div style="position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;background:#ffffff;transform:translate(-50%,-50%) rotate(45deg);"></div>
        </div>
      </div>
    `
  }

  if (kind === 'center') {
    return `
      <div style="position:relative;width:24px;height:24px;display:grid;place-items:center;">
        <div style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#ffb357,#ff6a3d);border:3px solid #ffffff;box-shadow:0 10px 22px rgba(255,106,61,0.38);"></div>
      </div>
    `
  }

  return `
    <div style="position:relative;width:18px;height:18px;display:grid;place-items:center;">
      <div style="width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#ff8c5a,#ff4d4f);border:2px solid #ffffff;box-shadow:0 6px 18px rgba(255,77,79,0.42);"></div>
    </div>
  `
}

function toValidFacilities(items: ScenicFacility[]) {
  return items.filter((item) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)))
}

function buildFallbackCategories(facilities: ScenicFacility[]): ScenicCategory[] {
  const categoryMap = new Map<number, ScenicCategory>()

  facilities.forEach((facility) => {
    if (!categoryMap.has(facility.categoryId)) {
      categoryMap.set(facility.categoryId, {
        id: facility.categoryId,
        name: facility.categoryName,
        sortOrder: categoryMap.size,
      })
    }
  })

  return Array.from(categoryMap.values())
}

export function MapPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const context = useMemo(() => parseNavigationContext(location.search), [location.search])
  const [spots, setSpots] = useState<ScenicSpot[]>([])
  const [facilities, setFacilities] = useState<ScenicFacility[]>([])
  const [categories, setCategories] = useState<ScenicCategory[]>([])
  const [activeRoute, setActiveRoute] = useState<MapRoute | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<MapLoadError | null>(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const [categoryPage, setCategoryPage] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [searchResultCount, setSearchResultCount] = useState(0)
  const [selectedFacility, setSelectedFacility] = useState<ScenicFacility | null>(null)
  const [cardPosition, setCardPosition] = useState<CardPosition | null>(null)
  const [hasAutoFitFacilities, setHasAutoFitFacilities] = useState(false)
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const placeSearchRef = useRef<any>(null)
  const scenicCenterMarkerRef = useRef<any>(null)
  const facilityMarkersRef = useRef<any[]>([])
  const searchMarkersRef = useRef<any[]>([])
  const routePolylineRef = useRef<any>(null)
  const selectedFacilityRef = useRef<ScenicFacility | null>(null)
  const initialUserPositionRef = useRef<[number, number] | null>(null)
  const searchGenerationGateRef = useRef(createMobileMapSearchGenerationGate())
  const searchDerivedSelectionRef = useRef(createMobileMapSearchDerivedSelection())

  const updateSelectedCardPosition = (facility: ScenicFacility | null) => {
    const map = mapInstanceRef.current
    const AMap = window.AMap
    const container = mapContainerRef.current
    if (!map || !AMap || !container || !facility) {
      setCardPosition(null)
      return
    }

    const pixel = map.lngLatToContainer?.(new AMap.LngLat(facility.longitude, facility.latitude))
    if (!pixel) {
      setCardPosition(null)
      return
    }

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const maxLeft = Math.max(16, containerWidth - CARD_WIDTH - 16)
    const maxTop = Math.max(16, containerHeight - CARD_HEIGHT - 16)
    const preferredLeft = pixel.x + CARD_GAP_X
    const fallbackLeft = pixel.x - CARD_WIDTH - CARD_GAP_X
    const left = preferredLeft + CARD_WIDTH <= containerWidth - 16
      ? preferredLeft
      : Math.max(16, Math.min(fallbackLeft, maxLeft))
    const top = Math.max(16, Math.min(pixel.y - CARD_HEIGHT + CARD_GAP_Y, maxTop))

    setCardPosition({ left, top })
  }

  useEffect(() => {
    if (!mobileCategoryOpen) return
    const closeCategories = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileCategoryOpen(false)
    }
    document.addEventListener('keydown', closeCategories)
    return () => document.removeEventListener('keydown', closeCategories)
  }, [mobileCategoryOpen])

  useEffect(() => {
    selectedFacilityRef.current = selectedFacility
    updateSelectedCardPosition(selectedFacility)
  }, [selectedFacility])

  useEffect(() => {
    async function loadMapData() {
      try {
        const [spotResult, facilityResult, categoryResult] = await Promise.allSettled([
          axios.get<ScenicSpot[]>('/api/user/scenic/spots'),
          axios.get<ScenicFacility[]>('/api/user/scenic/facilities'),
          axios.get<ScenicCategory[]>('/api/user/scenic/categories'),
        ])

        const nextSpots = spotResult.status === 'fulfilled' ? spotResult.value.data : []
        const nextFacilities = facilityResult.status === 'fulfilled'
          ? toValidFacilities(facilityResult.value.data ?? [])
          : []
        const nextCategories = categoryResult.status === 'fulfilled'
          ? categoryResult.value.data ?? []
          : buildFallbackCategories(nextFacilities)

        if (spotResult.status === 'rejected') {
          console.warn('load spots failed', spotResult.reason)
        }
        if (facilityResult.status === 'rejected') {
          console.warn('load facilities failed', facilityResult.reason)
        }
        if (categoryResult.status === 'rejected') {
          console.warn('load categories failed, fallback to facility categories', categoryResult.reason)
        }

        setSpots(nextSpots)
        setFacilities(nextFacilities)
        setCategories(nextCategories)
      } catch (error) {
        console.warn('load map data failed', error)
        setSpots([])
        setFacilities([])
        setCategories([])
      }
    }

    void loadMapData()
  }, [])

  useEffect(() => {
    if (!context.routeId) {
      setActiveRoute(null)
      return
    }
    axios.get<MapRoute[]>('/api/user/scenic/routes/recommend')
      .then(({ data }) => setActiveRoute(data.find((route) => route.id === context.routeId || route.name === context.routeId) ?? null))
      .catch((error) => console.warn('load selected route failed', error))
  }, [context.routeId])

  useEffect(() => {
    const selected = facilities.find((facility) => String(facility.id) === context.spotId
      || facility.name === context.spotName)
    if (selected) {
      searchDerivedSelectionRef.current.clear()
      setSelectedFacility(selected)
    }
  }, [context.spotId, context.spotName, facilities])

  useEffect(() => {
    setCategoryPage(0)
  }, [categories.length])

  const categoryCounts = useMemo(() => {
    const counts = new Map<number, number>()
    facilities.forEach((facility) => {
      counts.set(facility.categoryId, (counts.get(facility.categoryId) ?? 0) + 1)
    })
    return counts
  }, [facilities])

  const sidebarCategories = useMemo(() => {
    const allCategory: SidebarCategory = { key: 'all', label: '全部', icon: '●', count: facilities.length }
    const categoryItems: SidebarCategory[] = categories.map((category, index) => ({
      key: `category-${category.id}`,
      label: category.name,
      icon: CATEGORY_ICONS[index % CATEGORY_ICONS.length],
      categoryId: category.id,
      count: categoryCounts.get(category.id) ?? 0,
    }))

    if (categoryItems.length + FIXED_SIDEBAR_BUTTONS <= MAX_SIDEBAR_BUTTONS) {
      return [allCategory, ...categoryItems]
    }

    const pageSize = MAX_SIDEBAR_BUTTONS - FIXED_SIDEBAR_BUTTONS - MORE_BUTTON_SLOTS
    const pageCount = Math.max(1, Math.ceil(categoryItems.length / pageSize))
    const safePage = categoryPage % pageCount
    const start = safePage * pageSize
    const visibleItems = categoryItems.slice(start, start + pageSize)

    return [
      allCategory,
      ...visibleItems,
      { key: 'more', label: '更多', icon: '>', isMore: true },
    ]
  }, [categories, categoryCounts, categoryPage, facilities.length])

  const filteredFacilities = useMemo(() => {
    return facilities.filter((item) => activeCategory === 'all' || String(item.categoryId) === activeCategory)
  }, [activeCategory, facilities])

  const activeCategoryLabel = activeCategory === 'all'
    ? '全部'
    : categories.find((category) => String(category.id) === activeCategory)?.name ?? '当前分类'
  const categoryResultMessage = activeCategory !== 'all' && filteredFacilities.length === 0
    ? `${activeCategoryLabel}暂无已发布点位`
    : null

  useEffect(() => {
    let cancelled = false
    const searchGenerationGate = searchGenerationGateRef.current

    loadAMap()
      .then((AMap) => {
        if (cancelled || !mapContainerRef.current || mapInstanceRef.current) return

        const map = new AMap.Map(mapContainerRef.current, {
          zoom: 15,
          center: LINGSHAN_CENTER,
          viewMode: '2D',
        })
        mapInstanceRef.current = map
        setMapReady(true)
        requestAnimationFrame(() => {
          map.resize?.()
        })

        scenicCenterMarkerRef.current = new AMap.Marker({
          position: LINGSHAN_CENTER,
          title: '景区中心',
          anchor: 'bottom-center',
          offset: new AMap.Pixel(0, -6),
          content: buildMarkerContent('center'),
        })
        map.add(scenicCenterMarkerRef.current)

        map.on('click', () => {
          searchDerivedSelectionRef.current.clear()
          setSelectedFacility(null)
          setCardPosition(null)
        })

        const syncCard = () => updateSelectedCardPosition(selectedFacilityRef.current)
        map.on('zoomend', syncCard)
        map.on('moveend', syncCard)

        AMap.plugin(['AMap.PlaceSearch'], () => {
          if (cancelled) return

          placeSearchRef.current = new AMap.PlaceSearch({
            map: undefined,
            autoFitView: true,
            pageSize: 10,
            pageIndex: 1,
          })
        })
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
      placeSearchRef.current = null
      scenicCenterMarkerRef.current = null
      facilityMarkersRef.current = []
      searchMarkersRef.current = []
      searchGenerationGate.invalidate()
    }
  }, [])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = window.AMap
    if (!map || !AMap) return

    if (facilityMarkersRef.current.length) {
      map.remove?.(facilityMarkersRef.current)
      facilityMarkersRef.current = []
    }

    facilityMarkersRef.current = filteredFacilities.map((facility) => {
      const marker = new AMap.Marker({
        position: [facility.longitude, facility.latitude],
        title: facility.name,
        anchor: 'bottom-center',
        offset: new AMap.Pixel(0, -10),
        content: buildMarkerContent('facility'),
        label: {
          content: `<div class="map-facility-label">${facility.name}</div>`,
          direction: 'right',
          offset: new AMap.Pixel(18, -10),
        },
        zIndex: 130,
      })

      marker.on('click', () => {
        searchDerivedSelectionRef.current.clear()
        setSelectedFacility(facility)
      })

      return marker
    })

    if (facilityMarkersRef.current.length) {
      map.add?.(facilityMarkersRef.current)
    }

    if (!hasAutoFitFacilities && facilityMarkersRef.current.length) {
      const overlays = scenicCenterMarkerRef.current
        ? [scenicCenterMarkerRef.current, ...facilityMarkersRef.current]
        : [...facilityMarkersRef.current]
      map.setFitView?.(overlays, false, [72, 72, 72, 72], 15)
      setHasAutoFitFacilities(true)
    }

    if (selectedFacility && !filteredFacilities.some((item) => item.id === selectedFacility.id)) {
      setSelectedFacility(null)
      setCardPosition(null)
    }
  }, [filteredFacilities, hasAutoFitFacilities, mapReady, selectedFacility])

  useEffect(() => {
    const map = mapInstanceRef.current
    const AMap = window.AMap
    if (!map || !AMap) return
    if (routePolylineRef.current) map.remove?.(routePolylineRef.current)
    const path = (activeRoute?.polyline?.length ? activeRoute.polyline : activeRoute?.nodes?.map((node) => node.coordinate) ?? [])
      .map((point) => [point.longitude, point.latitude])
    if (path.length < 2) {
      routePolylineRef.current = null
      return
    }
    routePolylineRef.current = new AMap.Polyline({ path, strokeColor: '#1677ff', strokeWeight: 8, strokeOpacity: 0.9 })
    map.add?.(routePolylineRef.current)
    map.setFitView?.([routePolylineRef.current], false, [72, 72, 72, 72], 15)
  }, [activeRoute, mapReady])

  const handleZoom = (delta: number) => {
    const map = mapInstanceRef.current
    if (!map) return
    const next = (map.getZoom?.() ?? 15) + delta
    map.setZoom?.(next)
  }

  function removeSearchMarkers() {
    const map = mapInstanceRef.current
    if (map && searchMarkersRef.current.length) map.remove?.(searchMarkersRef.current)
    searchMarkersRef.current = []
    setSearchResultCount(0)
  }

  function clearSearchDerivedSelection() {
    if (!searchDerivedSelectionRef.current.beginSearch()) return
    setSelectedFacility(null)
    setCardPosition(null)
  }

  function clearSearchResults() {
    searchGenerationGateRef.current.invalidate()
    removeSearchMarkers()
    clearSearchDerivedSelection()
    setKeyword('')
  }

  const handleCategorySelect = (category: SidebarCategory) => {
    if (category.isMore) {
      const pageSize = MAX_SIDEBAR_BUTTONS - FIXED_SIDEBAR_BUTTONS - MORE_BUTTON_SLOTS
      const pageCount = Math.max(1, Math.ceil(categories.length / pageSize))
      setCategoryPage((current) => (current + 1) % pageCount)
      return
    }
    setActiveCategory(category.categoryId ? String(category.categoryId) : category.key)
    setMobileCategoryOpen(false)
  }

  const handleLocate = () => {
    const map = mapInstanceRef.current
    clearSearchResults()
    if (!map) return

    if (initialUserPositionRef.current) {
      map.setCenter?.(initialUserPositionRef.current)
      map.setZoom?.(16)
      return
    }

    if (!navigator.geolocation) {
      map.setCenter?.(LINGSHAN_CENTER)
      map.setZoom?.(15)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition: [number, number] = [position.coords.longitude, position.coords.latitude]
        initialUserPositionRef.current = nextPosition
        map.setCenter?.(nextPosition)
        map.setZoom?.(16)
      },
      () => {
        map.setCenter?.(LINGSHAN_CENTER)
        map.setZoom?.(15)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  const handleSearch = () => {
    const map = mapInstanceRef.current
    const query = keyword.trim()
    if (!map || !query) return
    const searchGeneration = searchGenerationGateRef.current.begin()
    clearSearchDerivedSelection()
    removeSearchMarkers()

    const matchedFacility = facilities.find((item) => item.name.includes(query) || item.categoryName.includes(query))
    if (matchedFacility) {
      map.setCenter?.([matchedFacility.longitude, matchedFacility.latitude])
      map.setZoom?.(17)
      searchDerivedSelectionRef.current.selectLocal(matchedFacility.id)
      setSelectedFacility(matchedFacility)
      setSearchResultCount(1)
      return
    }

    const placeSearch = placeSearchRef.current
    if (!placeSearch) return

    placeSearch.search(query, (status: string, result: any) => {
      if (!searchGenerationGateRef.current.isCurrent(searchGeneration)) return
      if (status !== 'complete') {
        console.warn('高德搜索失败', result)
        return
      }

      const pois = result?.poiList?.pois ?? []
      if (!pois.length) {
        return
      }

      searchMarkersRef.current = pois
        .filter((poi: any) => poi?.location)
        .slice(0, 5)
        .map((poi: any) => new window.AMap.Marker({
          position: [poi.location.lng, poi.location.lat],
          title: poi.name,
          anchor: 'bottom-center',
          offset: new window.AMap.Pixel(0, -6),
          content: buildMarkerContent('search'),
          label: {
            content: `<div class="map-search-label">${poi.name}</div>`,
            direction: 'right',
            offset: new window.AMap.Pixel(12, -4),
          },
        }))

      if (searchMarkersRef.current.length) {
        map.add?.(searchMarkersRef.current)
        map.setFitView?.(searchMarkersRef.current, false, [72, 72, 72, 72], 16)
      }
      setSearchResultCount(searchMarkersRef.current.length)
    })
  }

  const showClearSearch = shouldShowMobileMapClearAction(searchResultCount)
  const selectedFacilityQuery = selectedFacility
    ? new URLSearchParams({
        spotId: String(selectedFacility.id),
        spotName: selectedFacility.name,
      }).toString()
    : ''
  const liveRoute = selectedFacilityQuery ? `/live?${selectedFacilityQuery}` : '/live'
  const digitalHumanRoute = selectedFacilityQuery
    ? `${DIGITAL_HUMAN_ROUTE}?${selectedFacilityQuery}`
    : DIGITAL_HUMAN_ROUTE

  void spots

  return (
    <main className="page-shell page-shell--map">

      <section className="page-content page-content--map">
        <div className={`map-page${selectedFacility && cardPosition ? ' map-page--spot-selected' : ''}`}>
          <div className="map-page__main">
            <div className="map-mobile-toolbar">
              <button
                type="button"
                className="map-mobile-category-trigger"
                aria-expanded={mobileCategoryOpen}
                aria-controls="mobile-map-categories"
                onClick={() => setMobileCategoryOpen((open) => !open)}
              >
                分类
              </button>
              <div className="map-mobile-search-slot">
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleSearch()
                    }
                  }}
                  placeholder="搜索地点、景点或服务"
                />
                <button type="button" aria-label="搜索" onClick={handleSearch}>搜</button>
              </div>
            </div>
            <div id="mobile-map-categories" className="map-mobile-category-panel" hidden={!mobileCategoryOpen}>
              {sidebarCategories.map((category) => {
                const currentKey = category.categoryId ? String(category.categoryId) : category.key
                return (
                  <button
                    key={category.key}
                    type="button"
                    aria-pressed={activeCategory === currentKey}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <span aria-hidden>{category.icon}</span>
                    <span>{category.label}</span>
                    {!category.isMore ? <span className="map-sidebar__count">{category.count ?? 0}</span> : null}
                  </button>
                )
              })}
            </div>
            <div ref={mapContainerRef} className="map-page__canvas" />
            {mapError ? (
              <div className="map-route-context" role="alert">
                {mapError.message}
                {mapError.code === 'sdkLoadError' ? (
                  <button type="button" onClick={() => window.location.reload()}>重新加载</button>
                ) : null}
              </div>
            ) : null}
            {activeRoute ? <div className="map-route-context">正在展示：{activeRoute.name}</div> : null}
            {categoryResultMessage ? (
              <div className="map-category-result" role="status">
                {categoryResultMessage}
              </div>
            ) : null}

            {selectedFacility && cardPosition ? (
              <article
                className="map-spot-card"
                style={{
                  '--map-card-left': `${cardPosition.left}px`,
                  '--map-card-top': `${cardPosition.top}px`,
                } as CSSProperties}
                aria-label={`${selectedFacility.name} 信息卡片`}
              >
                {selectedFacility.image ? (
                  <div className="map-spot-card__cover">
                    <img src={selectedFacility.image} alt={selectedFacility.name} />
                  </div>
                ) : null}
                <div className="map-spot-card__body">
                  <div className="map-spot-card__title-row">
                    <h3>{selectedFacility.name}</h3>
                    <span className="map-spot-card__category">{selectedFacility.categoryName}</span>
                  </div>
                  <div className="map-spot-card__meta">
                    <span>开放时间</span>
                    <strong>{formatOpenHours(selectedFacility.openTime, selectedFacility.closeTime)}</strong>
                  </div>
                  <div className="map-spot-card__actions">
                    <button
                      type="button"
                      className="map-spot-card__action"
                      onClick={() => navigate(`/routes?spotId=${encodeURIComponent(String(selectedFacility.id))}`)}
                    >
                      路线导航
                    </button>
                    <button type="button" className="map-spot-card__action" onClick={() => navigate(liveRoute)}>
                      观看直播
                    </button>
                    <button type="button" className="map-spot-card__action" onClick={() => navigate(digitalHumanRoute)}>
                      AI 讲解
                    </button>
                  </div>
                </div>
              </article>
            ) : null}

            <aside className="map-sidebar" aria-label="分类筛选">
              {sidebarCategories.map((category) => {
                const currentKey = category.categoryId ? String(category.categoryId) : category.key
                return (
                  <button
                    key={category.key}
                    type="button"
                    className={`map-sidebar__item${activeCategory === currentKey ? ' map-sidebar__item--active' : ''}${category.isMore ? ' map-sidebar__item--more' : ''}`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <span className="map-sidebar__icon" aria-hidden>
                      {category.icon}
                    </span>
                    <span className="map-sidebar__label">{category.label}</span>
                    {!category.isMore ? <span className="map-sidebar__count">{category.count ?? 0}</span> : null}
                  </button>
                )
              })}
            </aside>

            <div className="map-search">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                placeholder="搜索地点、景点或服务"
              />
              <button type="button" className="map-search__btn" aria-label="搜索" onClick={handleSearch}>
                搜
              </button>
            </div>

            <div className="map-controls">
              <div className="map-compass" aria-hidden>
                <span>N</span>
              </div>
              <div className="map-ctrl-group">
                <button type="button" className="map-ctrl-btn" onClick={handleLocate} aria-label="定位">
                  ◎
                  <small>定位</small>
                </button>
              </div>
              <div className="map-ctrl-group">
                <button type="button" className="map-ctrl-btn" onClick={() => handleZoom(1)} aria-label="放大">
                  +
                </button>
                <button type="button" className="map-ctrl-btn" onClick={() => handleZoom(-1)} aria-label="缩小">
                  -
                </button>
              </div>
            </div>

            <div className="map-scale">200米</div>

            <div className="map-actions">
              <button type="button" onClick={handleLocate}>
                当前位置
              </button>
              <button type="button" onClick={() => handleZoom(1)}>
                放大
              </button>
              <button type="button" onClick={() => handleZoom(-1)}>
                缩小
              </button>
              <button type="button" onClick={() => mapInstanceRef.current?.setCenter?.(LINGSHAN_CENTER)}>
                景区中心
              </button>
              <button
                type="button"
                onClick={clearSearchResults}
              >
                清空搜索
              </button>
            </div>

            <div className="map-mobile-context-actions">
              <button type="button" onClick={() => mapInstanceRef.current?.setCenter?.(LINGSHAN_CENTER)}>景区中心</button>
              {showClearSearch ? <button type="button" onClick={clearSearchResults}>清除结果</button> : null}
            </div>

          </div>

        </div>
      </section>
    </main>
  )
}
