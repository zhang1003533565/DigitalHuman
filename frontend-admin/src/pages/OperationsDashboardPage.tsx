import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Statistic, Tag, Typography } from 'antd'
import * as echarts from 'echarts'
import { getOperationsOverview, type OperationsOverview, type RankedItem } from '../api/operations'

function useOverviewRegion() {
  const [data, setData] = useState<OperationsOverview>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setLoading(true); setError('')
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

function RegionError({ message, retry }: { message: string; retry: () => void }) {
  return <Alert type="error" showIcon message={message} action={<Button size="small" onClick={retry}>重试</Button>} />
}

function RankingChart({ title, data }: { title: string; data: RankedItem[] }) {
  const chartRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return
    const chart = echarts.init(chartRef.current)
    chart.setOption({ grid: { left: 90, right: 24, top: 18, bottom: 28 }, tooltip: { trigger: 'axis' }, xAxis: { type: 'value', minInterval: 1 }, yAxis: { type: 'category', data: data.map((item) => item.label).reverse() }, series: [{ type: 'bar', data: data.map((item) => item.count).reverse(), itemStyle: { color: '#1677ff', borderRadius: 4 } }] })
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); chart.dispose() }
  }, [data])
  return <Card title={title}>{data.length ? <div ref={chartRef} className="operations-chart" /> : <Empty description="暂无排行数据" />}</Card>
}

function MetricsRegion() {
  const { data, loading, error, load } = useOverviewRegion()
  if (loading) return <Card title="核心指标"><Skeleton active /></Card>
  if (error || !data) return <RegionError message={error || '核心指标不可用'} retry={() => void load()} />
  const metrics = [['游客数', data.visitorCount], ['会话数', data.sessionCount], ['消息数', data.messageCount], ['问答成功率', data.successRate, '%'], ['知识命中率', data.knowledgeHitRate, '%'], ['平均评分', data.averageRating]] as const
  return <Row gutter={[16, 16]}>{metrics.map(([title, value, suffix]) => <Col xs={24} sm={12} lg={8} key={title}><Card><Statistic title={title} value={value} suffix={suffix} precision={suffix || title === '平均评分' ? 1 : 0} /></Card></Col>)}</Row>
}

function RankingsRegion() {
  const { data, loading, error, load } = useOverviewRegion()
  if (loading) return <Card title="热门排行"><Skeleton active /></Card>
  if (error || !data) return <RegionError message={error || '排行数据不可用'} retry={() => void load()} />
  return <div className="operations-rankings"><RankingChart title="热门问题" data={data.popularQuestions ?? []} /><RankingChart title="热门路线" data={data.popularRoutes ?? []} /></div>
}

function HealthRegion() {
  const { data, loading, error, load } = useOverviewRegion()
  if (loading) return <Card title="服务健康"><Skeleton active /></Card>
  if (error || !data) return <RegionError message={error || '健康状态不可用'} retry={() => void load()} />
  const health = data.serviceHealth ?? []
  return <Card title="服务健康">{health.length === 0 ? <Empty description="暂无健康状态，业务指标不受影响" /> : <div className="service-health-list">{health.map((item) => {
    const normal = ['healthy', 'up', 'ok'].includes(item.status.toLowerCase())
    return <div key={item.name}><span>{item.name}</span><Tag color={normal ? 'success' : 'warning'}>{normal ? '正常' : '降级'}</Tag><Typography.Text type="secondary">{item.message}</Typography.Text></div>
  })}</div>}</Card>
}

export default function OperationsDashboardPage() {
  return <div className="admin-panel-grid operations-dashboard"><Typography.Title level={3}>运营总览</Typography.Title><MetricsRegion /><RankingsRegion /><HealthRegion /></div>
}
