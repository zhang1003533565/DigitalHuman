import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd'
import {
  BulbOutlined,
  LockOutlined,
  RobotOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import axios from 'axios'
import {
  TRAVEL_ANALYTICS_AI_METRICS,
  getTravelAnalyticsAiConfig,
  testTravelAnalyticsMetric,
  updateTravelAnalyticsAiConfig,
  type TravelAnalyticsAiConfig,
  type TravelAnalyticsMetric,
  type TravelAnalyticsMetricResponse,
} from '../../api/travelAnalytics'

const METRIC_OPTIONS: Array<{ value: TravelAnalyticsMetric; label: string; note: string }> = [
  { value: 'popular_attractions', label: '热门景点', note: '仅展示聚合后的景点热度，不返回单个游客轨迹。' },
  { value: 'average_stay_duration', label: '平均停留时长', note: '只返回群体平均停留分钟数与样本量。' },
  { value: 'average_spend', label: '平均消费', note: '仅基于聚合金额输出统计，不暴露个人消费明细。' },
  { value: 'average_satisfaction', label: '平均满意度', note: '展示 5 分制平均满意度，不返回单条评分记录。' },
  { value: 'common_visitor_segments', label: '常见客群', note: '只返回高频客群分布，不输出游客身份信息。' },
]

const SESSION_STORAGE_KEY = 'digitalhuman.admin.user'

export type TravelAnalyticsAiPanelHandle = {
  refresh: () => Promise<void>
}

function formatDateTime(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return value || '-'
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function readCurrentRole() {
  if (typeof window === 'undefined') return 'OBSERVER'
  const rawValue = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (!rawValue) return 'OBSERVER'
  try {
    const parsed = JSON.parse(rawValue) as { role?: string }
    return parsed.role === 'ADMIN' ? 'ADMIN' : 'OBSERVER'
  } catch {
    return 'OBSERVER'
  }
}

const TravelAnalyticsAiPanel = forwardRef<TravelAnalyticsAiPanelHandle>(function TravelAnalyticsAiPanel(_, ref) {
  const [role] = useState<'ADMIN' | 'OBSERVER'>(() => readCurrentRole())
  const [config, setConfig] = useState<TravelAnalyticsAiConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [publicEnabled, setPublicEnabled] = useState(true)
  const [summaryMetrics, setSummaryMetrics] = useState<TravelAnalyticsMetricResponse[]>([])
  const [selectedMetric, setSelectedMetric] = useState<TravelAnalyticsMetric>(TRAVEL_ANALYTICS_AI_METRICS[0])
  const [testResult, setTestResult] = useState<TravelAnalyticsMetricResponse | null>(null)

  const isObserver = role === 'OBSERVER'

  const loadPanel = useCallback(async (keepExistingTest = false) => {
    setLoading(true)
    try {
      const nextConfig = await getTravelAnalyticsAiConfig()
      setConfig(nextConfig)
      setPublicEnabled(nextConfig.publicEnabled)

      if (isObserver) {
        setSummaryMetrics([])
        if (!keepExistingTest) {
          setTestResult(null)
        }
        return
      }

      setMetricsLoading(true)
      const responses = await Promise.all(TRAVEL_ANALYTICS_AI_METRICS.map((metric) => testTravelAnalyticsMetric(metric)))
      setSummaryMetrics(responses)
      if (!keepExistingTest) {
        setTestResult(null)
      }
    } catch {
      message.error('加载 AI 数据权限失败')
    } finally {
      setMetricsLoading(false)
      setLoading(false)
    }
  }, [isObserver])

  useImperativeHandle(ref, () => ({
    refresh: async () => {
      await loadPanel(true)
    },
  }))

  useEffect(() => {
    void loadPanel()
  }, [loadPanel])

  const handleSave = async () => {
    if (!config || isObserver) return
    setSaving(true)
    try {
      const nextConfig = await updateTravelAnalyticsAiConfig({
        publicEnabled,
        minimumSampleSize: config.minimumSampleSize,
      })
      setConfig(nextConfig)
      setPublicEnabled(nextConfig.publicEnabled)
      message.success('AI 数据权限已保存')
      await loadPanel(true)
    } catch {
      message.error('保存 AI 数据权限失败')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    if (isObserver) return
    setTesting(true)
    try {
      const result = await testTravelAnalyticsMetric(selectedMetric)
      setTestResult(result)
      message.success('测试回答摘要已刷新')
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        message.error('观察员账号仅可查看配置，不能执行模型测试')
      } else {
        message.error('测试模型回答失败')
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card
      title="AI 数据权限"
      loading={loading}
      extra={(
        <Space>
          <Tag color={isObserver ? 'default' : 'blue'}>{isObserver ? 'Observer 只读' : '管理员可编辑'}</Tag>
          <Button icon={<SyncOutlined />} onClick={() => void loadPanel(true)} loading={loading || metricsLoading}>
            刷新摘要
          </Button>
        </Space>
      )}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="游客 ID、昵称和单条记录不会提供给模型"
          description="页面只允许五项固定统计指标，测试与游客问答都只能读取脱敏聚合结果，不支持任意查询表达式或原始行。"
        />

        <Card size="small" title="游客端开关">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={12} wrap>
              <Typography.Text strong>启用游客统计问答</Typography.Text>
              <Switch
                checked={publicEnabled}
                onChange={setPublicEnabled}
                disabled={isObserver || saving}
                checkedChildren="开启"
                unCheckedChildren="关闭"
              />
              <Button type="primary" onClick={() => void handleSave()} disabled={isObserver} loading={saving}>
                保存配置
              </Button>
            </Space>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="最小有效样本量">{config?.minimumSampleSize ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="配置更新时间">{config ? formatDateTime(config.updatedAt) : '-'}</Descriptions.Item>
            </Descriptions>
            {isObserver ? (
              <Typography.Text type="secondary">Observer 角色只能查看当前配置，不能修改开关或执行测试。</Typography.Text>
            ) : null}
          </Space>
        </Card>

        <Card size="small" title="五项白名单指标">
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {METRIC_OPTIONS.map((metric) => {
              const summary = summaryMetrics.find((item) => item.metric === metric.value)
              return (
                <Card key={metric.value} size="small">
                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Space>
                      <BulbOutlined />
                      <Typography.Text strong>{metric.label}</Typography.Text>
                    </Space>
                    <Typography.Text type="secondary">{metric.note}</Typography.Text>
                    <Space size={12} wrap>
                      <Tag color="processing">有效样本 {summary?.validSamples ?? '-'}</Tag>
                      <Tag>总样本 {summary?.totalSamples ?? '-'}</Tag>
                      <Tag color="gold">截至 {summary ? formatDateTime(summary.asOf) : '-'}</Tag>
                    </Space>
                    {summary?.warning ? <Typography.Text type="warning">{summary.warning}</Typography.Text> : null}
                  </Space>
                </Card>
              )
            })}
            {isObserver ? (
              <Alert
                type="warning"
                showIcon
                message="观察员不能发起后台模型测试"
                description="当前角色只读取 AI 配置；如需查看最新聚合摘要或执行测试，请使用管理员账号。"
              />
            ) : null}
          </Space>
        </Card>

        <Card size="small" title="测试模型回答">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Select
                value={selectedMetric}
                style={{ minWidth: 260 }}
                disabled={isObserver}
                onChange={setSelectedMetric}
                options={METRIC_OPTIONS.map((metric) => ({ value: metric.value, label: metric.label }))}
              />
              <Button
                type="primary"
                icon={<RobotOutlined />}
                disabled={isObserver}
                loading={testing}
                onClick={() => void handleTest()}
              >
                测试模型回答
              </Button>
            </Space>

            {testResult ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Descriptions size="small" column={2} bordered>
                  <Descriptions.Item label="指标">{METRIC_OPTIONS.find((item) => item.value === testResult.metric)?.label ?? testResult.metric}</Descriptions.Item>
                  <Descriptions.Item label="作用域">{testResult.scope}</Descriptions.Item>
                  <Descriptions.Item label="有效样本">{testResult.validSamples}</Descriptions.Item>
                  <Descriptions.Item label="总样本">{testResult.totalSamples}</Descriptions.Item>
                  <Descriptions.Item label="统计截至">{formatDateTime(testResult.asOf)}</Descriptions.Item>
                  <Descriptions.Item label="统计口径">{testResult.methodology}</Descriptions.Item>
                </Descriptions>
                {testResult.warning ? <Alert type="warning" showIcon message={testResult.warning} /> : null}
                {testResult.items.length ? (
                  <Descriptions size="small" column={1} bordered>
                    {testResult.items.map((item) => (
                      <Descriptions.Item key={item.label} label={item.label}>
                        {item.value}
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前统计结果没有可展示的聚合条目" />
                )}
              </Space>
            ) : (
              <Typography.Text type="secondary">
                请选择五项白名单指标之一执行测试。结果只展示 validSamples、totalSamples、asOf、warning 和聚合 items。
              </Typography.Text>
            )}
          </Space>
        </Card>

        <Alert
          type="success"
          showIcon
          icon={<LockOutlined />}
          message="受控访问边界"
          description="页面不会展示原始记录、游客 ID、昵称、任意 SQL、任意筛选器或导入后的明细内容，只允许管理员维护开关并查看脱敏聚合输出。"
        />
      </Space>
    </Card>
  )
})

export default TravelAnalyticsAiPanel
