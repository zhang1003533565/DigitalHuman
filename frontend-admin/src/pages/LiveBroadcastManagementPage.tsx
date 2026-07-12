import { useCallback, useEffect, useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  EditOutlined,
  PlusOutlined,
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
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
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
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<LiveScriptItem | null>(null)
  const [form] = Form.useForm<LiveScriptItemPayload>()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [nextItems, nextSummary] = await Promise.all([
        listLiveItems(),
        getPublishedLiveSummary(),
      ])
      setItems(nextItems)
      setSummary(nextSummary)
    } catch (error) {
      message.error(`加载直播文案失败：${errorMessage(error)}`)
    } finally {
      setLoading(false)
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
      setSaving(true)
      if (editingItem) {
        await updateLiveItem(editingItem.id, payload)
      } else {
        await createLiveItem(payload)
      }
      message.success('草稿已保存，发布后才会对游客生效')
      setModalOpen(false)
      await refresh()
    } catch (error) {
      if (isFormValidationError(error)) return
      message.error(`保存失败：${errorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const toggleItem = async (item: LiveScriptItem, enabled: boolean) => {
    try {
      await updateLiveItem(item.id, toPayload(item, enabled))
      await refresh()
    } catch (error) {
      message.error(`更新失败：${errorMessage(error)}`)
    }
  }

  const removeItem = async (id: number) => {
    try {
      await deleteLiveItem(id)
      message.success('草稿已删除')
      await refresh()
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
      setItems(reordered)
      setItems(await reorderLiveItems(reordered.map((item) => item.id)))
    } catch (error) {
      setItems(items)
      message.error(`排序失败：${errorMessage(error)}`)
    }
  }

  const publish = async () => {
    try {
      await publishLiveBroadcast()
      message.success('直播文案已发布')
      await refresh()
    } catch (error) {
      message.error(`发布失败：${errorMessage(error)}`)
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
        <Switch checked={enabled} onChange={(checked) => void toggleItem(item, checked)} />
      ),
    },
    {
      title: '操作',
      width: 270,
      render: (_, item, index) => (
        <Space wrap>
          <Button aria-label="上移" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => void moveItem(index, -1)} />
          <Button aria-label="下移" icon={<ArrowDownOutlined />} disabled={index === items.length - 1} onClick={() => void moveItem(index, 1)} />
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(item)}>编辑</Button>
          <Popconfirm title="确认删除这条草稿？" onConfirm={() => void removeItem(item.id)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="当前发布版本">
        {summary ? (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}><Statistic title="版本" value={summary.versionId} prefix="#" /></Col>
            <Col xs={12} md={6}><Statistic title="文案数" value={summary.itemCount} suffix="条" /></Col>
            <Col xs={12} md={6}><Statistic title="总时长" value={formatDuration(summary.totalDurationMs)} /></Col>
            <Col xs={12} md={6}><Statistic title="发布时间" value={new Date(summary.publishedAt).toLocaleString()} /></Col>
          </Row>
        ) : <Typography.Text type="secondary">尚未发布直播文案</Typography.Text>}
      </Card>

      <Card
        title="数字人直播文案"
        extra={(
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={openCreate}>新增文案</Button>
            <Popconfirm title="确认立即发布当前已启用的草稿？" onConfirm={() => void publish()}>
              <Button type="primary">立即发布</Button>
            </Popconfirm>
          </Space>
        )}
      >
        <Typography.Paragraph type="secondary">
          编辑、启用和排序只保存为草稿，点击“立即发布”后才会更新游客端直播内容。
        </Typography.Paragraph>
        <Table rowKey="id" loading={loading} dataSource={items} columns={columns} pagination={false} scroll={{ x: 900 }} />
      </Card>

      <Modal
        title={editingItem ? '编辑直播文案' : '新增直播文案'}
        open={modalOpen}
        confirmLoading={saving}
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
    </Space>
  )
}
