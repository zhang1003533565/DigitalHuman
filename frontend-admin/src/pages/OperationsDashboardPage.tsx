import { useEffect, useRef, useState } from 'react'
import { Alert, Card, Col, Empty, Row, Skeleton, Statistic, Tag, Typography } from 'antd'
import * as echarts from 'echarts'
import { getOperationsOverview, type OperationsOverview, type RankedItem } from '../api/operations'

function RankingChart({ title, data }: { title: string; data: RankedItem[] }) {
  const chartRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!chartRef.current || data.length === 0) return
    const chart = echarts.init(chartRef.current)
    chart.setOption({
      grid: { left: 90, right: 24, top: 18, bottom: 28 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: data.map((item) => item.label).reverse() },
      series: [{ type: 'bar', data: data.map((item) => item.count).reverse(), itemStyle: { color: '#1677ff', borderRadius: 4 } }],
    })
    const resize = () => chart.resize()
    window.addEventListener('resize', resize)
    return () => { window.removeEventListener('resize', resize); chart.dispose() }
  }, [data])
  return <Card title={title}>{data.length ? <div ref={chartRef} className="operations-chart" /> : <Empty description="暂无排行数据" />}</Card>
}

export default function OperationsDashboardPage() {
  const [data, setData] = useState<OperationsOverview>()
  const [error, setError] = useState('')
  useEffect(() => { void getOperationsOverview().then(setData).catch(() => setError('运营数据加载失败，请稍后重试。')) }, [])
  if (error) return <Alert type="error" showIcon message={error} />
  if (!data) return <Skeleton active />
  const metrics = [
    ['游客数', data.visitorCount], ['会话数', data.sessionCount], ['消息数', data.messageCount],
    ['问答成功率', data.successRate, '%'], ['知识命中率', data.knowledgeHitRate, '%'], ['平均评分', data.averageRating],
  ] as const
  return <div className="admin-panel-grid operations-dashboard">
    <Typography.Title level={3}>运营总览</Typography.Title>
    <Row gutter={[16, 16]}>{metrics.map(([title, value, suffix]) => <Col xs={24} sm={12} lg={8} key={title}><Card><Statistic title={title} value={value} suffix={suffix} precision={suffix || title === '平均评分' ? 1 : 0} /></Card></Col>)}</Row>
    <div className="operations-rankings"><RankingChart title="热门问题" data={data.popularQuestions} /><RankingChart title="热门路线" data={data.popularRoutes} /></div>
    <Card title="服务健康"><div className="service-health-list">{data.serviceHealth.map((item) => <div key={item.name}><span>{item.name}</span><Tag color={item.status === 'ok' ? 'success' : 'warning'}>{item.status === 'ok' ? '正常' : '降级'}</Tag><Typography.Text type="secondary">{item.message}</Typography.Text></div>)}</div></Card>
  </div>
}
