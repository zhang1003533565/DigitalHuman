import { useEffect, useMemo, useState } from 'react'
import { CheckCircleOutlined, EyeOutlined, MessageOutlined, SearchOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Drawer, Empty, Input, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { getQaSessionMessages, listQaSessions, type QaMessage, type QaSessionSummary } from '../api/qaRecords'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function QaRecordsPage() {
  const [sessions, setSessions] = useState<QaSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [scope, setScope] = useState('all')
  const [selected, setSelected] = useState<QaSessionSummary>()
  const [messages, setMessages] = useState<QaMessage[]>([])
  const [messageLoading, setMessageLoading] = useState(false)
  const [renderedAt] = useState(() => Date.now())

  const load = async () => {
    setLoading(true); setError('')
    try { setSessions(await listQaSessions()) }
    catch { setError('问答记录加载失败，请确认后台服务已启动。') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    void listQaSessions()
      .then((data) => { if (active) setSessions(data) })
      .catch(() => { if (active) setError('问答记录加载失败，请确认后台服务已启动。') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase()
    const boundary = scope === 'today' ? renderedAt - 86_400_000 : scope === 'week' ? renderedAt - 604_800_000 : 0
    return sessions.filter((item) => {
      const matchesTerm = !term || [item.sessionId, item.latestQuestion, item.latestAnswer].some((value) => value?.toLowerCase().includes(term))
      return matchesTerm && new Date(item.updatedAt).getTime() >= boundary
    })
  }, [keyword, renderedAt, scope, sessions])

  const openSession = async (session: QaSessionSummary) => {
    setSelected(session); setMessageLoading(true); setMessages([])
    try { setMessages(await getQaSessionMessages(session.sessionId)) }
    catch { setMessages([]) }
    finally { setMessageLoading(false) }
  }

  const columns: TableColumnsType<QaSessionSummary> = [
    { title: '最近提问', dataIndex: 'latestQuestion', ellipsis: true, render: (value: string) => <strong>{value || '会话尚无游客提问'}</strong> },
    { title: '最近回答', dataIndex: 'latestAnswer', ellipsis: true, render: (value: string) => <Typography.Text type="secondary">{value || '等待数字人回答'}</Typography.Text> },
    { title: '消息', dataIndex: 'messageCount', width: 78, render: (value: number) => <span><MessageOutlined /> {value}</span> },
    { title: '知识命中', dataIndex: 'knowledgeHitCount', width: 100, render: (value: number) => <Tag color={value > 0 ? 'success' : 'warning'}>{value > 0 ? `${value} 次` : '未命中'}</Tag> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 128, render: (value: string) => dateFormatter.format(new Date(value)) },
    { title: '操作', width: 82, render: (_, row) => <Button type="link" icon={<EyeOutlined />} onClick={() => void openSession(row)}>详情</Button> },
  ]

  const totalMessages = sessions.reduce((sum, item) => sum + item.messageCount, 0)
  const hitSessions = sessions.filter((item) => item.knowledgeHitCount > 0).length

  return (
    <div className="qa-records-page">
      <section className="qa-records-metrics">
        <article><MessageOutlined /><span>会话总数<strong>{sessions.length}</strong></span></article>
        <article><CheckCircleOutlined /><span>知识命中会话<strong>{hitSessions}</strong></span></article>
        <article><SearchOutlined /><span>累计消息<strong>{totalMessages}</strong></span></article>
      </section>
      <Card className="qa-records-workbench" title="会话记录" extra={<Button onClick={() => void load()}>刷新数据</Button>}>
        <div className="qa-records-toolbar">
          <Input allowClear prefix={<SearchOutlined />} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索问题、回答或会话 ID" />
          <Select value={scope} onChange={setScope} options={[{ value: 'all', label: '全部时间' }, { value: 'today', label: '最近 24 小时' }, { value: 'week', label: '最近 7 天' }]} />
          <span>共 {filtered.length} 条会话</span>
        </div>
        {error ? <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void load()}>重试</Button>} /> : null}
        <Table<QaSessionSummary> rowKey="sessionId" loading={loading} dataSource={filtered} columns={columns} pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 860 }} />
      </Card>
      <Drawer className="qa-session-drawer" width={520} open={Boolean(selected)} onClose={() => setSelected(undefined)} title="会话详情">
        {selected ? <Space direction="vertical" size={4}><Tag color="blue">{selected.sessionId}</Tag><Typography.Text type="secondary">创建于 {new Date(selected.createdAt).toLocaleString('zh-CN')}</Typography.Text></Space> : null}
        <div className="qa-message-stream">
          {messageLoading ? <Spin /> : messages.length ? messages.map((item, index) => <article className={`qa-message qa-message--${item.role}`} key={`${item.timestamp}-${index}`}><span>{item.role === 'user' ? '游客' : '数字人'}</span><p>{item.content}</p><small>{dateFormatter.format(new Date(item.timestamp))}</small></article>) : <Empty description="暂无会话消息" />}
        </div>
      </Drawer>
    </div>
  )
}
