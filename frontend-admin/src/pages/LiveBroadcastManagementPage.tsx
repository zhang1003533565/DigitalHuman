import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import livePresenter from '../assets/digital-human-live.png'
import {
  createLiveItem,
  deleteLiveItem,
  getPublishedLiveSummary,
  listLiveItems,
  publishLiveBroadcast,
  reorderLiveItems,
  updateLiveItem,
  type LivePublishSummary,
  type LiveScriptItem,
  type LiveScriptItemPayload,
} from '../api/liveBroadcast'

const DEFAULT_DURATION_MS = 10_000

function formatDuration(durationMs: number) {
  const seconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return minutes ? `${minutes} 分 ${remainingSeconds} 秒` : `${remainingSeconds} 秒`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请稍后重试'
}

function toPayload(item: LiveScriptItem, enabled = item.enabled): LiveScriptItemPayload {
  return {
    title: item.title,
    content: item.content,
    durationMs: item.durationMs,
    sortOrder: item.sortOrder,
    enabled,
  }
}

function isFormValidationError(error: unknown) {
  return typeof error === 'object' && error !== null && 'errorFields' in error
}

export default function LiveBroadcastManagementPage() {
  const [items, setItems] = useState<LiveScriptItem[]>([])
  const [summary, setSummary] = useState<LivePublishSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [mutationPending, setMutationPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LiveScriptItem | null>(null)
  const [form] = Form.useForm<LiveScriptItemPayload>()
  const operationPendingRef = useRef(false)
  const refreshGenerationRef = useRef(0)

  const runDraftMutation = async (operation: () => Promise<void>) => {
    if (operationPendingRef.current) return false
    operationPendingRef.current = true
    setMutationPending(true)
    try {
      await operation()
      return true
    } finally {
      operationPendingRef.current = false
      setMutationPending(false)
    }
  }

  const refresh = useCallback(async () => {
    const generation = ++refreshGenerationRef.current
    setLoading(true)
    try {
      const [nextItems, nextSummary] = await Promise.all([
        listLiveItems(),
        getPublishedLiveSummary(),
      ])
      if (generation === refreshGenerationRef.current) {
        setItems(nextItems)
        setSummary(nextSummary)
      }
    } catch (error) {
      message.error(`加载直播文案失败：${errorMessage(error)}`)
    } finally {
      if (generation === refreshGenerationRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial mount intentionally loads remote admin data
    void refresh()
  }, [refresh])

  const openCreate = () => {
    setEditingItem(null)
    form.setFieldsValue({
      title: '',
      content: '',
      durationMs: DEFAULT_DURATION_MS,
      sortOrder: items.length,
      enabled: true,
    })
    setModalOpen(true)
  }

  const openEdit = (item: LiveScriptItem) => {
    setEditingItem(item)
    form.setFieldsValue(item)
    setModalOpen(true)
  }

  const saveItem = async () => {
    try {
      const payload = await form.validateFields()
      await runDraftMutation(async () => {
        setSaving(true)
        try {
          if (editingItem) {
            await updateLiveItem(editingItem.id, payload)
          } else {
            await createLiveItem(payload)
          }
          message.success('草稿已保存，发布后才会对游客生效')
          setModalOpen(false)
          await refresh()
        } finally {
          setSaving(false)
        }
      })
    } catch (error) {
      if (isFormValidationError(error)) return
      message.error(`保存失败：${errorMessage(error)}`)
    }
  }

  const toggleItem = async (item: LiveScriptItem, enabled: boolean) => {
    try {
      await runDraftMutation(async () => {
        await updateLiveItem(item.id, toPayload(item, enabled))
        await refresh()
      })
    } catch (error) {
      message.error(`更新失败：${errorMessage(error)}`)
    }
  }

  const removeItem = async (id: number) => {
    try {
      await runDraftMutation(async () => {
        await deleteLiveItem(id)
        message.success('草稿已删除')
        await refresh()
      })
    } catch (error) {
      message.error(`删除失败：${errorMessage(error)}`)
    }
  }

  const moveItem = async (index: number, offset: -1 | 1) => {
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= items.length) return
    const reordered = [...items]
    ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]
    try {
      await runDraftMutation(async () => {
        setItems(reordered)
        try {
          setItems(await reorderLiveItems(reordered.map((item) => item.id)))
        } catch (error) {
          setItems(await listLiveItems())
          throw error
        }
      })
    } catch (error) {
      message.error(`排序失败：${errorMessage(error)}`)
    }
  }

  const publish = async () => {
    if (operationPendingRef.current) return
    operationPendingRef.current = true
    setPublishing(true)
    try {
      await publishLiveBroadcast()
      message.success('直播文案已发布')
      await refresh()
    } catch (error) {
      message.error(`发布失败：${errorMessage(error)}`)
    } finally {
      operationPendingRef.current = false
      setPublishing(false)
    }
  }

  const columns: TableColumnsType<LiveScriptItem> = [
    { title: '顺序', width: 72, render: (_, __, index) => index + 1 },
    { title: '标题', dataIndex: 'title', width: 180 },
    { title: '文案正文', dataIndex: 'content', ellipsis: true },
    {
      title: '时长',
      dataIndex: 'durationMs',
      width: 110,
      render: (value: number) => formatDuration(value),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (enabled: boolean, item) => (
        <Switch disabled={mutationPending || publishing} loading={mutationPending} checked={enabled} onChange={(checked) => void toggleItem(item, checked)} />
      ),
    },
    {
      title: '操作',
      width: 270,
      render: (_, item, index) => (
        <Space wrap>
          <Button aria-label="上移" icon={<ArrowUpOutlined />} loading={mutationPending} disabled={mutationPending || publishing || index === 0} onClick={() => void moveItem(index, -1)} />
          <Button aria-label="下移" icon={<ArrowDownOutlined />} loading={mutationPending} disabled={mutationPending || publishing || index === items.length - 1} onClick={() => void moveItem(index, 1)} />
          <Button type="link" icon={<EditOutlined />} disabled={mutationPending || publishing} onClick={() => openEdit(item)}>编辑</Button>
          <Popconfirm disabled={mutationPending || publishing} title="确认删除这条草稿？" onConfirm={() => void removeItem(item.id)}>
            <Button type="link" danger loading={mutationPending} disabled={mutationPending || publishing}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const activeItem = items.find((item) => item.enabled) ?? items[0]

  return (
    <div className="live-broadcast-management-page">
      <section className="live-status-strip">
        <article><PlayCircleOutlined /><span>直播状态<strong>{summary ? '持续直播中' : '等待首次发布'}</strong></span></article>
        <article><span>当前版本<strong>{summary ? `#${summary.versionId}` : '--'}</strong></span></article>
        <article><span>启用文案<strong>{items.filter((item) => item.enabled).length} 条</strong></span></article>
        <article><ClockCircleOutlined /><span>轮播总时长<strong>{summary ? formatDuration(summary.totalDurationMs) : '0 秒'}</strong></span></article>
      </section>

      <div className="live-workbench">
        <Card
          className="live-script-card"
          title="直播文案队列"
          extra={(
            <Space wrap>
              <Button icon={<PlusOutlined />} disabled={mutationPending || publishing} onClick={openCreate}>新增文案</Button>
              <Popconfirm disabled={mutationPending || publishing || loading} title="确认立即发布当前已启用的草稿？" onConfirm={() => void publish()}>
                <Button type="primary" loading={publishing} disabled={mutationPending || publishing || loading}>发布新版本</Button>
              </Popconfirm>
            </Space>
          )}
        >
          <Typography.Paragraph type="secondary">文案按顺序持续轮播，游客进入不会打断或重新开始直播进度。</Typography.Paragraph>
          <Table rowKey="id" loading={loading || mutationPending} dataSource={items} columns={columns} pagination={false} scroll={{ x: 900 }} />
        </Card>

        <section className="live-preview-panel">
          <header><strong>直播预览</strong><Tag color={summary ? 'success' : 'default'}>{summary ? '直播中' : '未发布'}</Tag></header>
          <div className="live-preview-stage" style={{ backgroundImage: `linear-gradient(180deg, transparent 46%, rgba(3,15,24,.88)), url(${livePresenter})` }}>
            <span className="live-preview-badge"><i />LIVE</span>
            <div><strong>{activeItem?.title || '景区欢迎词'}</strong><p>{activeItem?.content || '发布直播文案后，数字人会按照设定顺序持续轮播。'}</p></div>
          </div>
          <footer><span><PlayCircleOutlined /> 当前文案 {activeItem ? formatDuration(activeItem.durationMs) : '--'}</span><span><UserOutlined /> 持续服务</span></footer>
        </section>
      </div>

      {summary ? <Card size="small" title="当前发布版本"><Row gutter={[16, 8]}><Col span={6}><Statistic title="版本" value={summary.versionId} prefix="#" /></Col><Col span={6}><Statistic title="文案数" value={summary.itemCount} suffix="条" /></Col><Col span={6}><Statistic title="总时长" value={formatDuration(summary.totalDurationMs)} /></Col><Col span={6}><Statistic title="发布时间" value={new Date(summary.publishedAt).toLocaleString()} /></Col></Row></Card> : null}

      <Modal
        title={editingItem ? '编辑直播文案' : '新增直播文案'}
        open={modalOpen}
        confirmLoading={saving}
        okButtonProps={{ disabled: mutationPending && !saving }}
        cancelButtonProps={{ disabled: saving }}
        closable={!saving}
        onOk={() => void saveItem()}
        onCancel={() => setModalOpen(false)}
        width={680}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true, message: '请输入标题' }]}>
            <Input maxLength={200} showCount />
          </Form.Item>
          <Form.Item name="content" label="文案正文" rules={[{ required: true, whitespace: true, message: '请输入文案正文' }]}>
            <Input.TextArea rows={8} showCount />
          </Form.Item>
          <Form.Item name="durationMs" label="播放时长（毫秒）" rules={[{ required: true, message: '请输入播放时长' }]}>
            <InputNumber min={1000} max={600000} step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sortOrder" hidden><InputNumber /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
