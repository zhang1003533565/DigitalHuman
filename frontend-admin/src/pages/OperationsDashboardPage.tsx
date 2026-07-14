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
import scenicTwin from '../assets/scenic-admin-bg.png'
import { getOperationsOverview, type OperationsOverview, type RankedItem } from '../api/operations'

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
    ['游客数', data.visitorCount, '', '+12.6%'],
    ['会话数', data.sessionCount, '', '-1.7%'],
    ['消息数', data.messageCount, '', '+8.9%'],
    ['问答成功率', data.successRate, '%', '+3.1%'],
    ['知识命中率', data.knowledgeHitRate, '%', '+2.6%'],
    ['平均评分', data.averageRating, '', '+0.2'],
  ] as const
  return (
    <section className="cockpit-metric-stack" aria-label="实时运营指标">
      <h2>实时运营指标</h2>
      {metrics.map(([title, value, suffix, trend], index) => {
        const Icon = metricIcons[index]
        return <article className="cockpit-metric" key={title}><Icon /><div><span>{title}</span><strong>{Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}{suffix}</strong><small className={trend.startsWith('-') ? 'is-down' : ''}>较昨日 {trend}</small></div></article>
      })}
    </section>
  )
}

function TwinMap() {
  return (
    <section className="cockpit-twin" style={{ backgroundImage: `linear-gradient(180deg, rgba(3,16,25,.08), rgba(3,16,25,.62)), url(${scenicTwin})` }}>
      <div className="cockpit-twin__legend"><span>游客热力分布</span><i /><small>低</small><b /><small>高</small></div>
      <div className="cockpit-layer-control"><strong>图层控制</strong>{['热力图层', '客流密度', '路线网络', '景点设施'].map((item) => <span key={item}>{item}<i /></span>)}</div>
      {[
        ['观景台', '32%', '27%'], ['湖中群', '63%', '48%'], ['避暑馆', '50%', '70%'],
      ].map(([name, left, top]) => <div className="cockpit-map-marker" key={name} style={{ left, top }}><EnvironmentOutlined /><span>{name}</span></div>)}
      <div className="cockpit-map-tools"><Button>◎</Button><Button>＋</Button><Button>－</Button></div>
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
      <RankingChart title="客流与问答趋势" data={data.popularQuestions ?? []} />
      <section className="cockpit-ranking"><h2>热门路线 TOP 5</h2>{(data.popularRoutes ?? []).slice(0, 5).map((item, index) => <div key={item.label}><b>{index + 1}</b><span>{item.label}</span><strong>{item.count.toLocaleString()}</strong><i style={{ width: `${Math.max(18, 100 - index * 13)}%` }} /></div>)}</section>
    </div>
  )
}

function HealthRegion({ region }: { region: OverviewRegionState }) {
  const { data, loading, error, load } = region
  if (loading) return <section className="cockpit-health"><Skeleton active /></section>
  if (error || !data) return <RegionError message={error || '健康状态不可用'} retry={() => void load()} />
  const health = data.serviceHealth ?? []
  const alerts = [
    ['高客流预警', '观景台区域客流已达 85%'],
    ['知识命中率偏低', '景点介绍类问题需补充知识'],
    ['直播运行正常', '数字人直播稳定轮播中'],
  ]
  return (
    <aside className="cockpit-side-status">
      <section><h2>实时告警 <a>查看全部</a></h2>{alerts.map(([title, copy], index) => <article key={title}><AlertOutlined className={index === 2 ? 'is-ok' : ''}/><div><strong>{title}</strong><span>{copy}</span></div><small>{index === 2 ? '10:08' : `10:${42 - index * 7}`}</small></article>)}</section>
      <section className="cockpit-health"><h2>服务状态</h2>{health.length === 0 ? <Empty description="暂无健康状态" /> : <div className="service-health-list">{health.map((item) => {
        const normal = ['healthy', 'up', 'ok'].includes(item.status.toLowerCase())
        return <div key={item.name}><span><i />{item.name}</span><Tag color={normal ? 'success' : 'warning'}>{normal ? '运行中' : '降级'}</Tag><Typography.Text type="secondary">{item.message}</Typography.Text></div>
      })}</div>}</section>
    </aside>
  )
}

export default function OperationsDashboardPage() {
  const region = useOverviewRegion()
  return (
    <div className="operations-dashboard">
      <div className="cockpit-dashboard-main"><MetricsRegion region={region} /><TwinMap /><HealthRegion region={region} /></div>
      <RankingsRegion region={region} />
    </div>
  )
}
