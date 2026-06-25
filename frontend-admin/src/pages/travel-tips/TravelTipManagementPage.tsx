import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { useDeferredMount } from '../../hooks/useDeferredMount'

type TravelTipRow = {
  key: string
  id?: string
  title: string
  category: string
  content: string
  icon?: string
  sortOrder: number
  enabled: boolean
}

const CATEGORY_OPTIONS = [
  { value: 'transport', label: '交通指南' },
  { value: 'ticket', label: '门票信息' },
  { value: 'time', label: '最佳游览时间' },
  { value: 'items', label: '必备物品' },
  { value: 'safety', label: '安全提示' },
  { value: 'food', label: '餐饮推荐' },
  { value: 'notice', label: '注意事项' },
]

const CATEGORY_LABEL_MAP: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((opt) => [opt.value, opt.label]),
)

function TravelTipManagementPageInner() {
  const [tips, setTips] = useState<TravelTipRow[]>([])
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTip, setEditingTip] = useState<TravelTipRow | null>(null)
  const [form] = Form.useForm()

  async function loadTips() {
    setLoading(true)
    try {
      const response = await axios.get<TravelTipRow[]>('/api/admin/travel-tips')
      const rows: TravelTipRow[] = response.data.map((tip) => ({
        key: tip.id,
        ...tip,
      }))
      setTips(rows)
    } catch {
      message.error('加载贴士失败')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditingTip(null)
    form.resetFields()
    form.setFieldsValue({ enabled: true, sortOrder: 0 })
    setDrawerOpen(true)
  }

  function openEdit(tip: TravelTipRow) {
    setEditingTip(tip)
    form.setFieldsValue({
      title: tip.title,
      category: tip.category,
      content: tip.content,
      icon: tip.icon,
      sortOrder: tip.sortOrder,
      enabled: tip.enabled,
    })
    setDrawerOpen(true)
  }

  async function handleDelete(id: string) {
    try {
      await axios.delete(`/api/admin/travel-tips/${id}`)
      message.success('删除成功')
      void loadTips()
    } catch {
      message.error('删除失败')
    }
  }

  async function handleSubmit() {
    try {
      const values = await form.validateFields()
      if (editingTip?.id) {
        await axios.put(`/api/admin/travel-tips/${editingTip.id}`, values)
        message.success('更新成功')
      } else {
        await axios.post('/api/admin/travel-tips', values)
        message.success('创建成功')
      }
      setDrawerOpen(false)
      void loadTips()
    } catch {
      message.error('保存失败')
    }
  }

  const tipColumns: TableColumnsType<TravelTipRow> = useMemo(
    () => [
      { title: '标题', dataIndex: 'title', width: 160 },
      {
        title: '分类',
        dataIndex: 'category',
        width: 120,
        render: (cat: string) => <Tag color="blue">{CATEGORY_LABEL_MAP[cat] || cat}</Tag>,
      },
      {
        title: '排序',
        dataIndex: 'sortOrder',
        width: 80,
        sorter: (a, b) => a.sortOrder - b.sortOrder,
      },
      {
        title: '状态',
        dataIndex: 'enabled',
        width: 90,
        render: (enabled: boolean) => (
          <Tag color={enabled ? 'green' : 'default'}>{enabled ? '启用' : '停用'}</Tag>
        ),
      },
      {
        title: '操作',
        width: 160,
        render: (_: unknown, record: TravelTipRow) => (
          <Space>
            <Button type="link" size="small" onClick={() => openEdit(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确定删除该贴士？"
              onConfirm={() => handleDelete(record.id!)}
              okText="删除"
              cancelText="取消"
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useDeferredMount(() => {
    void loadTips()
  })

  return (
    <Card
      title="游览贴士管理"
      extra={
        <Button type="primary" onClick={openCreate}>
          新增贴士
        </Button>
      }
    >
      <Table
        columns={tipColumns}
        dataSource={tips}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        rowKey="key"
      />

      <Drawer
        title={editingTip ? '编辑贴士' : '新增贴士'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={560}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="如：交通指南" maxLength={120} />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类" options={CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入内容' }]}
          >
            <Input.TextArea rows={6} placeholder="请输入贴士详细内容" />
          </Form.Item>

          <Form.Item name="icon" label="图标（可选）">
            <Input placeholder="如：" maxLength={50} />
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  )
}

export default function TravelTipManagementPage() {
  return <TravelTipManagementPageInner />
}
