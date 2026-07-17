import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  MessageOutlined,
  StarOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Alert, Button, Empty, Skeleton, Tag, Typography } from 'antd'
import * as echarts from 'echarts'
import { loadMapConfig } from '../api/mapConfig'
import {
  getOperationsOverview,
  type AlertItem,
  type MapMarker,
  type OperationsOverview,
  type RankedItem,
} from '../api/operations'

type DashboardWindow = Omit<Window, 'AMap' | '_AMapSecurityConfig'> & {
  _AMapSecurityConfig?: { securityJsCode: string }
  AMap?: unknown
}

type DashboardAMapApi = {
  Map: new (container: HTMLDivElement, options: object) => DashboardAMapInstance
  Marker: new (options: object) => DashboardAMapOverlay
  Polyline: new (options: object) => DashboardAMapOverlay
  LngLat: new (longitude: number, latitude: number) => unknown
}

type DashboardAMapInstance = {
  add: (overlay: DashboardAMapOverlay | DashboardAMapOverlay[]) => void
  remove: (overlay: DashboardAMapOverlay | DashboardAMapOverlay[]) => void
  destroy: () => void
  setFitView: (overlays?: DashboardAMapOverlay[], immediate?: boolean, padding?: number[]) => void
}

type DashboardAMapOverlay = unknown

let amapLoaderPromise: Promise<DashboardAMapApi> | null = null

async function loadAMap(): Promise<DashboardAMapApi> {
  const mapConfig = await loadMapConfig()
  if (!mapConfig.configured || !mapConfig.amapKey || !mapConfig.amapSecurityKey) {
    throw new Error('地图服务未配置，请先在后台地图配置中保存高德 Key')
  }
  const dashboardWindow = window as unknown as DashboardWindow
  if (dashboardWindow.AMap) return dashboardWindow.AMap as DashboardAMapApi
  if (amapLoaderPromise) return amapLoaderPromise
  dashboardWindow._AMapSecurityConfig = { securityJsCode: mapConfig.amapSecurityKey }
  amapLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${mapConfig.amapKey}`
    script.async = true
    script.onload = () => {
      if (dashboardWindow.AMap) resolve(dashboardWindow.AMap as DashboardAMapApi)
      else {
        amapLoaderPromise = null
        reject(new Error('地图脚本加载后未提供 AMap API'))
      }
    }
    script.onerror = () => {
      amapLoaderPromise = null
      reject(new Error('高德地图脚本加载失败'))
    }
    document.head.appendChild(script)
  })
  return amapLoaderPromise
}

function useOverviewRegion() {
  const [data, setData] = useState<OperationsOverview>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setData(await getOperationsOverview()) }
    catch { setError('数据加载失败，请稍后重试。') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    void getOperationsOverview()
      .then((overview) => { if (active) setData(overview) })
      .catch(() => { if (active) setError('数据加载失败，请稍后重试。') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  return { data, loading, error, load }
}

type OverviewRegionState = ReturnType<typeof useOverviewRegion>

function RegionError({ message, retry }: { message: string; retry: () => void }) {
  return <Alert type="error" showIcon message={message} action={<Button size="small" onClick={retry}>重试</Button>} />
}

const metricIcons = [TeamOutlined, MessageOutlined, AlertOutlined, CheckCircleOutlined, EnvironmentOutlined, StarOutlined]

function MetricsRegion({ region }: { region: OverviewRegionState }) {
  const { data, loading, error, load } = region
  if (loading) return <div className="cockpit-metric-stack"><Skeleton active /></div>
  if (error || !data) return <RegionError message={error || '核心指标不可用'} retry={() => void load()} />
  const metrics = [
    ['游客数', 'visitorCount', data.visitorCount, ''],
    ['会话数', 'sessionCount', data.sessionCount, ''],
    ['消息数', 'messageCount', data.messageCount, ''],
    ['问答成功率', 'successRate', data.successRate, '%'],
    ['知识命中率', 'knowledgeHitRate', data.knowledgeHitRate, '%'],
    ['平均评分', 'averageRating', data.averageRating, ''],
  ] as const
  return (
    <section className="cockpit-metric-stack" aria-label="实时运营指标">
      <h2>实时运营指标</h2>
      {metrics.map(([title, key, value, suffix], index) => {
        const Icon = metricIcons[index]
        const trend = data.metricTrends?.[key]
        const trendText = trend?.percentChange == null
          ? (trend?.baselineLabel ?? '暂无昨日基线')
          : `${trend.baselineLabel} ${trend.percentChange >= 0 ? '+' : ''}${trend.percentChange.toFixed(1)}%`
        return <article className="cockpit-metric" key={title}><Icon /><div><span>{title}</span><strong>{Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}{suffix}</strong><small className={trend?.percentChange != null && trend.percentChange < 0 ? 'is-down' : ''}>{trendText}</small></div></article>
      })}
    </section>
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] ?? char)
}

function formatMarkerLabel(marker: MapMarker) {
  return `<div class="cockpit-amap-marker"><strong>${escapeHtml(marker.name)}</strong><span>${escapeHtml(marker.summary || marker.type)}</span></div>`
}

function TwinMap({ region }: { region: OverviewRegionState }) {
  const { data, loading, error, load } = region
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<DashboardAMapInstance | null>(null)
  const overlaysRef = useRef<DashboardAMapOverlay[]>([])
  const [mapError, setMapError] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!mapRef.current || !data || data.mapMarkers.length === 0) return
    loadAMap()
      .then((AMap) => {
        if (cancelled || !mapRef.current) return
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new AMap.Map(mapRef.current, {
            zoom: 16,
            center: [data.mapMarkers[0].longitude, data.mapMarkers[0].latitude],
            viewMode: '2D',
            mapStyle: 'amap://styles/normal',
          })
        }
        const map = mapInstanceRef.current
        if (overlaysRef.current.length) map.remove(overlaysRef.current)
        const markers = data.mapMarkers.map((marker) => new AMap.Marker({
          position: new AMap.LngLat(marker.longitude, marker.latitude),
          title: marker.name,
          content: formatMarkerLabel(marker),
        }))
        const routes = data.mapRoutes
          .filter((route) => route.path.length >= 2)
          .map((route) => new AMap.Polyline({
            path: route.path.map((point) => [point.longitude, point.latitude]),
            strokeColor: '#1677ff',
            strokeWeight: 6,
            strokeOpacity: 0.82,
            lineJoin: 'round',
            lineCap: 'round',
          }))
        overlaysRef.current = [...routes, ...markers]
        map.add(overlaysRef.current)
        map.setFitView(overlaysRef.current, false, [56, 56, 56, 56])
        setMapError('')
      })
      .catch((loadError) => {
        if (!cancelled) setMapError(loadError instanceof Error ? loadError.message : '地图加载失败')
      })
    return () => { cancelled = true }
  }, [data])

  useEffect(() => () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy()
      mapInstanceRef.current = null
      overlaysRef.current = []
    }
  }, [])

  if (loading) return <section className="cockpit-twin"><Skeleton active /></section>
  if (error || !data) return <section className="cockpit-twin"><RegionError message={error || '地图数据不可用'} retry={() => void load()} /></section>
  return (
    <section className="cockpit-twin">
      <div ref={mapRef} className="cockpit-amap" />
      <div className="cockpit-map-summary">
        <strong>高德地图</strong>
        <span>{data.mapMarkers.length} 个点位 · {data.mapRoutes.length} 条路线</span>
      </div>
      {data.mapMarkers.length === 0 ? <div className="cockpit-map-empty"><Empty description="暂无可展示点位" /></div> : null}
      {mapError ? <div className="cockpit-map-error"><Alert type="warning" showIcon message={mapError} /></div> : null}
    </section>
  )
}

function RankingChart({ title, data }: { title: string; data: RankedItem[] }) {
  const chartRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      backgroundColor: 'transparent',
      grid: { left: 38, right: 16, top: 32, bottom: 24 },
      tooltip: { trigger: 'axis', backgroundColor: '#071522', borderColor: '#1d556c', textStyle: { color: '#dff8ff' } },
      xAxis: { type: 'category', data: data.map((item) => item.label), axisLabel: { color: '#7795a8', fontSize: 10 }, axisLine: { lineStyle: { color: '#214052' } } },
      yAxis: { type: 'value', minInterval: 1, axisLabel: { color: '#7795a8', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(91,142,168,.14)' } } },
      series: [{ type: 'line', smooth: true, data: data.map((item) => item.count), symbol: 'none', lineStyle: { color: '#19c4d2', width: 2 }, areaStyle: { color: 'rgba(25,196,210,.12)' } }],
    })
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); chart.dispose() }
  }, [data])
  return <section className="cockpit-chart-panel"><h2>{title}</h2>{data.length ? <div ref={chartRef} className="operations-chart" /> : <Empty description="暂无排行数据" />}</section>
}

function RankingsRegion({ region }: { region: OverviewRegionState }) {
  const { data, loading, error, load } = region
  if (loading) return <section className="cockpit-chart-panel"><Skeleton active /></section>
  if (error || !data) return <RegionError message={error || '排行数据不可用'} retry={() => void load()} />
  return (
    <div className="operations-rankings">
      <RankingChart title="热门问题 TOP 5" data={data.popularQuestions ?? []} />
      <section className="cockpit-ranking"><h2>热门路线 TOP 5</h2>{data.popularRoutes.length === 0 ? <Empty description="暂无路线排行" /> : data.popularRoutes.slice(0, 5).map((item, index) => <div key={item.label}><b>{index + 1}</b><span>{item.label}</span><strong>{item.count.toLocaleString()}</strong><i style={{ width: `${Math.max(18, 100 - index * 13)}%` }} /></div>)}</section>
    </div>
  )
}

function HealthRegion({ region }: { region: OverviewRegionState }) {
  const { data, loading, error, load } = region
  if (loading) return <section className="cockpit-health"><Skeleton active /></section>
  if (error || !data) return <RegionError message={error || '健康状态不可用'} retry={() => void load()} />
  const health = data.serviceHealth ?? []
  const alerts = data.alerts ?? []
  return (
    <aside className="cockpit-side-status">
      <section><h2>实时告警</h2>{alerts.length === 0 ? <Empty description="暂无告警" /> : alerts.map((item) => <DashboardAlert item={item} key={`${item.title}-${item.time}`} />)}</section>
      <section className="cockpit-health"><h2>服务状态</h2>{health.length === 0 ? <Empty description="暂无健康状态" /> : <div className="service-health-list">{health.map((item) => {
        const normal = ['healthy', 'up', 'ok'].includes(item.status.toLowerCase())
        return <div key={item.name}><span><i />{item.name}</span><Tag color={normal ? 'success' : 'warning'}>{normal ? '运行中' : '降级'}</Tag><Typography.Text type="secondary">{item.message}</Typography.Text></div>
      })}</div>}</section>
    </aside>
  )
}

function DashboardAlert({ item }: { item: AlertItem }) {
  const ok = item.level === 'success'
  return <article><AlertOutlined className={ok ? 'is-ok' : ''}/><div><strong>{item.title}</strong><span>{item.message}</span></div><small>{item.time}</small></article>
}

export default function OperationsDashboardPage() {
  const region = useOverviewRegion()
  return (
    <div className="operations-dashboard">
      <div className="cockpit-dashboard-main"><MetricsRegion region={region} /><TwinMap region={region} /><HealthRegion region={region} /></div>
      <RankingsRegion region={region} />
    </div>
  )
}
