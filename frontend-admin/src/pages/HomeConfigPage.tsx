import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  Table,
  Tabs,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'

type HomeConfigItem = {
  id: string
  type: 'BANNER' | 'AD' | 'SPOT_RECOMMEND' | 'ROUTE_RECOMMEND'
  title: string
  imageUrl: string
  linkUrl: string
  description: string
  sortOrder: number
  enabled: boolean
  createdAt: string
}

const TYPE_OPTIONS = [
  { value: 'BANNER', label: '轮播图' },
  { value: 'AD', label: '广告位' },
  { value: 'SPOT_RECOMMEND', label: '今日景点推荐' },
  { value: 'ROUTE_RECOMMEND', label: '今日路线推荐' },
]

const TYPE_LABELS: Record<string, string> = {
  BANNER: '轮播图',
  AD: '广告位',
  SPOT_RECOMMEND: '今日景点推荐',
  ROUTE_RECOMMEND: '今日路线推荐',
}

export default function HomeConfigPage() {
  const [items, setItems] = useState<HomeConfigItem[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<HomeConfigItem | null>(null)
  const [activeTab, setActiveTab] = useState('ALL')
  const [form] = Form.useForm()

  const loadItems = async () => {
    setLoading(true)
    try {
      const params = activeTab === 'ALL' ? {} : { type: activeTab }
      const res = await axios.get<HomeConfigItem[]>('/api/admin/home-config', { params })
      setItems(res.data)
    } catch {
      message.error('加载首页配置失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadItems()
  }, [activeTab])

  const openCreate = () => {
    setEditingItem(null)
    form.resetFields()
    form.setFieldsValue({ type: activeTab === 'ALL' ? 'BANNER' : activeTab, sortOrder: 0, enabled: true })
    setModalOpen(true)
  }

  const openEdit = (item: HomeConfigItem) => {
    setEditingItem(item)
    form.setFieldsValue(item)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      if (editingItem) {
        await axios.put(`/api/admin/home-config/${editingItem.id}`, values)
        message.success('更新成功')
      } else {
        await axios.post('/api/admin/home-config', values)
        message.success('创建成功')
      }
      setModalOpen(false)
      void loadItems()
    } catch {
      // validation failed
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    await axios.patch(`/api/admin/home-config/${id}/toggle`, { enabled })
    void loadItems()
  }

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定删除？',
      onOk: async () => {
        await axios.delete(`/api/admin/home-config/${id}`)
        message.success('删除成功')
        void loadItems()
      },
    })
  }

  const columns: TableColumnsType<HomeConfigItem> = [
    { title: '标题', dataIndex: 'title', width: 180 },
    { title: '类型', dataIndex: 'type', width: 120, render: (v: string) => TYPE_LABELS[v] || v },
    {
      title: '图片',
      dataIndex: 'imageUrl',
      width: 100,
      render: (v: string) => v ? <img src={v} alt="" style={{ width: 60, height: 36, objectFit: 'cover', borderRadius: 4 }} /> : '-',
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sortOrder', width: 70 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (v: boolean, record) => (
        <Switch checked={v} onChange={(checked) => void handleToggle(record.id, checked)} />
      ),
    },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <>
          <Button type="link" size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </>
      ),
    },
  ]

  const tabItems = [
    { key: 'ALL', label: '全部' },
    ...TYPE_OPTIONS.map((t) => ({ key: t.value, label: t.label })),
  ]

  return (
    <Card
      title="首页配置管理"
      extra={<Button type="primary" onClick={openCreate}>新增配置</Button>}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingItem ? '编辑配置' : '新增配置'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select options={TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="如：灵山大佛春季特惠" />
          </Form.Item>
          <Form.Item name="imageUrl" label="图片地址">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="linkUrl" label="跳转链接">
            <Input placeholder="点击后跳转的路径或URL" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="简要描述内容" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序（越小越前）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="enabled" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  )
}
