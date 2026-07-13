/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect -- AMap SDK is untyped and this legacy page synchronizes imperative map state in effects. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import './MapPage.css'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import { parseNavigationContext } from './navigationContext'
import { getLiveStatus } from '../api/liveBroadcast'
import {
  getMobileMapLiveLabel,
  shouldShowMobileMapClearAction,
  toggleMobileMapDrawer,
  type MobileMapDrawerState,
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
}

type SidebarCategory = {
  key: string
  label: string
  icon: string
  categoryId?: number
  isMore?: boolean
}

type CardPosition = {
  left: number
  top: number
}

type RouteCoordinate = { longitude: number; latitude: number }
type MapRoute = { id: string; name: string; polyline?: RouteCoordinate[]; nodes?: Array<{ coordinate: RouteCoordinate }> }

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY
const AMAP_SECURITY_KEY = import.meta.env.VITE_AMAP_SECURITY_KEY
const LINGSHAN_CENTER: [number, number] = [120.1009, 31.4259]
const CARD_WIDTH = 260
const CARD_HEIGHT = 190
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

function loadAMap(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (!AMAP_KEY || !AMAP_SECURITY_KEY) {
    return Promise.reject({ code: 'configMissing', message: '地图服务未配置，请联系管理员' } satisfies MapLoadError)
  }
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapLoaderPromise) return amapLoaderPromise

  window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_KEY }
  amapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`
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
  const [liveStatus, setLiveStatus] = useState<'loading' | 'live' | 'ready' | 'error'>('loading')
  const [mobileDrawerState, setMobileDrawerState] = useState<MobileMapDrawerState>('collapsed')
  const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const geolocationRef = useRef<any>(null)
  const placeSearchRef = useRef<any>(null)
  const scenicCenterMarkerRef = useRef<any>(null)
  const facilityMarkersRef = useRef<any[]>([])
  const searchMarkersRef = useRef<any[]>([])
  const routePolylineRef = useRef<any>(null)
  const selectedFacilityRef = useRef<ScenicFacility | null>(null)
  const initialUserPositionRef = useRef<[number, number] | null>(null)
  const hasAutoLocatedRef = useRef(false)
  const liveStatusGenerationRef = useRef(0)
  const mobileDrawerRef = useRef<HTMLElement | null>(null)
  const mobileDrawerTriggerRef = useRef<HTMLButtonElement | null>(null)

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerState('collapsed')
    window.requestAnimationFrame(() => mobileDrawerTriggerRef.current?.focus())
  }, [])

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
    let controller: AbortController | null = null
    const syncMapLiveStatus = () => {
      const generation = ++liveStatusGenerationRef.current
      controller?.abort()
      const currentController = new AbortController()
      controller = currentController
      getLiveStatus({ signal: currentController.signal })
        .then((status) => {
          if (generation !== liveStatusGenerationRef.current || currentController.signal.aborted) return
          setLiveStatus(status.status === 'live' ? 'live' : 'ready')
        })
        .catch(() => {
          if (generation !== liveStatusGenerationRef.current || currentController.signal.aborted) return
          setLiveStatus('error')
        })
    }
    const handleVisibility = () => { if (document.visibilityState === 'visible') syncMapLiveStatus() }
    syncMapLiveStatus()
    const refreshTimer = window.setInterval(syncMapLiveStatus, 30_000)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      liveStatusGenerationRef.current += 1
      controller?.abort()
      window.clearInterval(refreshTimer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (mobileDrawerState !== 'expanded') return
    const panel = mobileDrawerRef.current
    const focusable = Array.from(panel?.querySelectorAll<HTMLElement>(
      'a[href]:not([tabindex="-1"]), button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    focusable[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (mobileCategoryOpen) return
        event.preventDefault()
        closeMobileDrawer()
        return
      }
      if (event.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable.at(-1) ?? first
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeMobileDrawer, mobileCategoryOpen, mobileDrawerState])

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
    if (selected) setSelectedFacility(selected)
  }, [context.spotId, context.spotName, facilities])

  useEffect(() => {
    setCategoryPage(0)
  }, [categories.length])

  const sidebarCategories = useMemo(() => {
    const allCategory: SidebarCategory = { key: 'all', label: '全部', icon: '●' }
    const categoryItems: SidebarCategory[] = categories.map((category, index) => ({
      key: `category-${category.id}`,
      label: category.name,
      icon: CATEGORY_ICONS[index % CATEGORY_ICONS.length],
      categoryId: category.id,
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
  }, [categories, categoryPage])

  const filteredFacilities = useMemo(() => {
    return facilities.filter((item) => activeCategory === 'all' || String(item.categoryId) === activeCategory)
  }, [activeCategory, facilities])

  useEffect(() => {
    let cancelled = false

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

        scenicCenterMarkerRef.current = new AMap.Marker({
          position: LINGSHAN_CENTER,
          title: '景区中心',
          anchor: 'bottom-center',
          offset: new AMap.Pixel(0, -6),
          content: buildMarkerContent('center'),
        })
        map.add(scenicCenterMarkerRef.current)

        map.on('click', () => {
          setSelectedFacility(null)
          setCardPosition(null)
        })

        const syncCard = () => updateSelectedCardPosition(selectedFacilityRef.current)
        map.on('zoomend', syncCard)
        map.on('moveend', syncCard)

        AMap.plugin(['AMap.Geolocation', 'AMap.PlaceSearch'], () => {
          if (cancelled) return

          const geolocation = new AMap.Geolocation({
            enableHighAccuracy: true,
            timeout: 10000,
            buttonPosition: 'RB',
            showButton: false,
            showMarker: true,
            showCircle: true,
            panToLocation: true,
            zoomToAccuracy: true,
          })
          map.addControl(geolocation)
          geolocationRef.current = geolocation

          if (!hasAutoLocatedRef.current) {
            hasAutoLocatedRef.current = true
            geolocation.getCurrentPosition((status: string, result: any) => {
              if (cancelled) return
              if (status === 'complete' && result?.position) {
                const lng = result.position.lng
                const lat = result.position.lat
                initialUserPositionRef.current = [lng, lat]
                map.setCenter?.([lng, lat])
              } else {
                console.warn('定位失败', result?.message ?? result)
              }
            })
          }

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
      geolocationRef.current = null
      placeSearchRef.current = null
      scenicCenterMarkerRef.current = null
      facilityMarkersRef.current = []
      searchMarkersRef.current = []
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
  }, [filteredFacilities, hasAutoFitFacilities, selectedFacility])

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

  function clearSearchResults() {
    const map = mapInstanceRef.current
    if (map && searchMarkersRef.current.length) map.remove?.(searchMarkersRef.current)
    searchMarkersRef.current = []
    setSearchResultCount(0)
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
  }

  const handleLocate = () => {
    const map = mapInstanceRef.current
    if (!map) return

    clearSearchResults()

    if (initialUserPositionRef.current) {
      map.setCenter?.(initialUserPositionRef.current)
      map.setZoom?.(16)
      return
    }

    map.setCenter?.(LINGSHAN_CENTER)
  }

  const handleSearch = () => {
    const map = mapInstanceRef.current
    const query = keyword.trim()
    if (!map || !query) return

    const matchedFacility = facilities.find((item) => item.name.includes(query) || item.categoryName.includes(query))
    if (matchedFacility) {
      map.setCenter?.([matchedFacility.longitude, matchedFacility.latitude])
      map.setZoom?.(17)
      setSelectedFacility(matchedFacility)
      return
    }

    const placeSearch = placeSearchRef.current
    if (!placeSearch) return

    if (searchMarkersRef.current.length) {
      map.remove?.(searchMarkersRef.current)
      searchMarkersRef.current = []
    }
    setSearchResultCount(0)

    placeSearch.search(query, (status: string, result: any) => {
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

  const liveLabel = getMobileMapLiveLabel(liveStatus)
  const showClearSearch = shouldShowMobileMapClearAction(keyword, searchResultCount)

  function renderLiveCard() {
    return (
      <div className="side-card live-card">
        <div className="side-card__head">
          <h3>AI数字人直播</h3>
          <span className="side-card__status">{liveStatus === 'live' ? '在线' : liveStatus === 'error' ? '同步失败' : '准备中'}</span>
        </div>
        <div className="live-card__chat">
          <div className="live-card__msg">
            <span className="live-card__msg-tag live-card__msg-tag--cyan">灵</span>
            <b>直播讲解示例：</b>景区文化与游览提示
          </div>
          <div className="live-card__msg">
            <span className="live-card__msg-tag live-card__msg-tag--gold">灵</span>
            <b>直播讲解示例：</b>景点故事与参观礼仪
          </div>
          <div className="live-card__msg">
            <span className="live-card__msg-tag live-card__msg-tag--cyan">灵</span>
            <b>直播讲解示例：</b>路线与附近服务介绍
          </div>
        </div>
        <div className="live-card__actions">
          <button type="button" className="live-card__btn live-card__btn--primary" onClick={() => navigate('/live')}>
            进入直播间
          </button>
          <button type="button" className="live-card__btn live-card__btn--ghost" onClick={() => navigate(DIGITAL_HUMAN_ROUTE)}>
            语音互动
          </button>
        </div>
      </div>
    )
  }

  function renderNearbyCard() {
    return (
      <div className="side-card">
        <div className="side-card__head">
          <h3>附近服务</h3>
          <button type="button" className="map-route-card__more">查看更多</button>
        </div>
        <div className="nearby__grid nearby__grid--3">
          <div className="nearby__item">
            <div className="nearby__icon nearby__icon--blue">P</div>
            <span>停车场</span>
          </div>
          <div className="nearby__item">
            <div className="nearby__icon nearby__icon--cyan">⌘</div>
            <span>卫生间</span>
          </div>
          <div className="nearby__item">
            <div className="nearby__icon nearby__icon--orange">✦</div>
            <span>餐饮</span>
          </div>
          <div className="nearby__item">
            <div className="nearby__icon nearby__icon--purple">◉</div>
            <span>游客中心</span>
          </div>
          <div className="nearby__item">
            <div className="nearby__icon nearby__icon--green">↺</div>
            <span>接驳车</span>
          </div>
          <div className="nearby__item">
            <div className="nearby__icon nearby__icon--red">!</div>
            <span>医务点</span>
          </div>
        </div>
      </div>
    )
  }

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
                  <button
                    type="button"
                    className="map-spot-card__action"
                    onClick={() => navigate(`/routes?spotId=${encodeURIComponent(String(selectedFacility.id))}`)}
                  >
                    路线导航
                  </button>
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
                    <span>{category.label}</span>
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

          <aside className="map-side">
            {renderLiveCard()}
            {renderNearbyCard()}
          </aside>

          <section className={`map-mobile-drawer map-mobile-drawer--${mobileDrawerState}`} aria-label="地图服务">
            <button
              ref={mobileDrawerTriggerRef}
              type="button"
              aria-expanded={mobileDrawerState === 'expanded'}
              onClick={() => {
                setMobileCategoryOpen(false)
                setMobileDrawerState((state) => toggleMobileMapDrawer(state))
              }}
            >
              AI 数字人 · {liveLabel}{'\u3000'}附近服务
            </button>
            {mobileDrawerState === 'expanded' ? (
              <div className="map-mobile-drawer__overlay" onMouseDown={closeMobileDrawer}>
                <article
                  ref={mobileDrawerRef}
                  className="map-mobile-drawer__panel"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mobile-map-drawer-title"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <header className="map-mobile-drawer__header">
                    <div>
                      <span>景区服务</span>
                      <h2 id="mobile-map-drawer-title">边走边看，服务随行</h2>
                    </div>
                    <button type="button" aria-label="关闭景区服务" onClick={closeMobileDrawer}>×</button>
                  </header>
                  {renderLiveCard()}
                  {renderNearbyCard()}
                </article>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  )
}
