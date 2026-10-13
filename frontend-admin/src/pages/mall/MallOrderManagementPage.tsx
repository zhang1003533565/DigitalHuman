import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useDeferredMount } from '../../hooks/useDeferredMount'
import {
  MALL_ORDER_STATUS_COLORS,
  MALL_ORDER_STATUS_OPTIONS,
  listOrders,
  updateOrderStatus,
  type MallOrder,
  type MallOrderStatus,
} from '../../api/mall'

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: '全部状态' },
  ...MALL_ORDER_STATUS_OPTIONS,
]

function formatAmount(value: number) {
  return `¥${Number(value ?? 0).toFixed(2)}`
}

function formatTime(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 19)
}

/** 顶部统计卡：让运营在不下拉表格的情况下看到当日盘子。 */
type OrderStats = {
  total: number
  pending: number
  completed: number
  cancelled: number
  revenue: number
}

function computeStats(orders: MallOrder[]): OrderStats {
  return orders.reduce<OrderStats>(
    (accumulator, order) => {
      accumulator.total += 1
      if (order.status === 'PENDING') accumulator.pending += 1
      if (order.status === 'COMPLETED') accumulator.completed += 1
      if (order.status === 'CANCELLED') accumulator.cancelled += 1
      // 已取消订单不计入成交额
      if (order.status !== 'CANCELLED') {
        accumulator.revenue += Number(order.totalAmount ?? 0)
      }
      return accumulator
    },
    { total: 0, pending: 0, completed: 0, cancelled: 0, revenue: 0 },
  )
}

function MallOrderManagementPageInner() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [detailOrder, setDetailOrder] = useState<MallOrder | null>(null)
  const [cancelTarget, setCancelTarget] = useState<MallOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  async function loadOrders() {
    setLoading(true)
    try {
      setOrders(await listOrders())
    } catch {
      message.error('加载订单失败')
    } finally {
      setLoading(false)
    }
  }

  async function changeStatus(order: MallOrder, status: MallOrderStatus, reason?: string) {
    setUpdatingId(order.id)
    try {
      const updated = await updateOrderStatus(order.id, status, reason)
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      message.success(`订单状态已更新为「${updated.statusLabel}」`)
    } catch (error) {
      const description =
        error && typeof error === 'object' && 'response' in error
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((error as any).response?.data?.message ?? '订单状态更新失败')
          : '订单状态更新失败'
      message.error(description)
    } finally {
      setUpdatingId(null)
    }
  }

  function openCancel(order: MallOrder) {
    setCancelTarget(order)
    setCancelReason('')
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    await changeStatus(cancelTarget, 'CANCELLED', cancelReason.trim() || undefined)
    setCancelTarget(null)
  }

  const filtered = useMemo(() => {
    const term = keyword.trim().toLowerCase()
    return orders.filter((order) => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter
      const matchesKeyword =
        !term ||
        order.id.toLowerCase().includes(term) ||
        (order.displayName ?? '').toLowerCase().includes(term) ||
        order.username.toLowerCase().includes(term) ||
        order.receiverName.toLowerCase().includes(term) ||
        order.receiverPhone.includes(term)
      return matchesStatus && matchesKeyword
    })
  }, [orders, statusFilter, keyword])

  const stats = useMemo(() => computeStats(orders), [orders])

  const columns: TableColumnsType<MallOrder> = useMemo(
    () => [
      {
        title: '订单号',
        dataIndex: 'id',
        width: 240,
        render: (id: string, record) => (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setDetailOrder(record)}>
            {id}
          </Button>
        ),
      },
      {
        title: '下单用户',
        dataIndex: 'displayName',
        width: 140,
        render: (displayName: string | null, record) => displayName || record.username,
      },
      {
        title: '金额',
        dataIndex: 'totalAmount',
        width: 110,
        sorter: (a, b) => a.totalAmount - b.totalAmount,
        render: (value: number) => <strong>{formatAmount(value)}</strong>,
      },
      { title: '件数', dataIndex: 'itemCount', width: 80 },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        render: (status: string, record) => (
          <Tag color={MALL_ORDER_STATUS_COLORS[status] ?? 'default'}>{record.statusLabel}</Tag>
        ),
      },
      {
        title: '下单时间',
        dataIndex: 'createdAt',
        width: 180,
        sorter: (a, b) => a.createdAt.localeCompare(b.createdAt),
        render: (value: string) => formatTime(value),
      },
      {
        title: '操作',
        width: 220,
        render: (_: unknown, record) => {
          const terminal = record.status === 'COMPLETED' || record.status === 'CANCELLED'
          return (
            <Space>
              <Button type="link" size="small" onClick={() => setDetailOrder(record)}>
                详情
              </Button>
              <Select
                size="small"
                style={{ width: 120 }}
                value={record.status}
                loading={updatingId === record.id}
                disabled={terminal}
                options={MALL_ORDER_STATUS_OPTIONS}
                onChange={(next) => {
                  if (next === 'CANCELLED') {
                    openCancel(record)
                    return
                  }
                  void changeStatus(record, next as MallOrderStatus)
                }}
              />
            </Space>
          )
        },
      },
    ],
    [updatingId],
  )

  useDeferredMount(() => {
    void loadOrders()
  })

  return (
    <Card
      title="景区商城订单管理"
      extra={
        <Button icon={<ReloadOutlined />} onClick={() => void loadOrders()}>
          刷新
        </Button>
      }
    >
      <Space style={{ marginBottom: 16 }} wrap size="large">
        <Statistic title="订单总数" value={stats.total} />
        <Statistic title="待处理" value={stats.pending} valueStyle={{ color: '#d48806' }} />
        <Statistic title="已完成" value={stats.completed} valueStyle={{ color: '#389e0d' }} />
        <Statistic title="已取消" value={stats.cancelled} />
        <Statistic title="成交额" value={stats.revenue} precision={2} prefix="¥" />
      </Space>

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          allowClear
          placeholder="搜索订单号、用户或收货人"
          style={{ width: 260 }}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
        <Select
          value={statusFilter}
          style={{ width: 160 }}
          onChange={setStatusFilter}
          options={STATUS_FILTER_OPTIONS}
        />
        <span>
          显示 {filtered.length} / {orders.length} 条
        </span>
        {statusFilter !== 'all' || keyword.trim() ? (
          <Button
            type="link"
            size="small"
            onClick={() => {
              setStatusFilter('all')
              setKeyword('')
            }}
          >
            重置筛选
          </Button>
        ) : null}
      </Space>

      <Table
        columns={columns}
        dataSource={filtered}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1000 }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Drawer
        title="订单详情"
        open={Boolean(detailOrder)}
        onClose={() => setDetailOrder(null)}
        width={640}
      >
        {detailOrder ? (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="订单号">{detailOrder.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={MALL_ORDER_STATUS_COLORS[detailOrder.status] ?? 'default'}>
                  {detailOrder.statusLabel}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="下单用户">
                {detailOrder.displayName || detailOrder.username}（ID: {detailOrder.userId}）
              </Descriptions.Item>
              <Descriptions.Item label="收货人">{detailOrder.receiverName}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{detailOrder.receiverPhone}</Descriptions.Item>
              <Descriptions.Item label="收货地址">{detailOrder.receiverAddress || '—'}</Descriptions.Item>
              <Descriptions.Item label="游客备注">{detailOrder.remark || '—'}</Descriptions.Item>
              {detailOrder.cancelReason ? (
                <Descriptions.Item label="取消原因">{detailOrder.cancelReason}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label="下单时间">{formatTime(detailOrder.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{formatTime(detailOrder.updatedAt)}</Descriptions.Item>
            </Descriptions>

            <Table
              size="small"
              pagination={false}
              rowKey={(record) => `${record.productId}-${record.quantity}`}
              dataSource={detailOrder.items}
              columns={[
                { title: '商品', dataIndex: 'productName' },
                {
                  title: '单价',
                  dataIndex: 'unitPrice',
                  width: 100,
                  render: (value: number) => formatAmount(value),
                },
                { title: '数量', dataIndex: 'quantity', width: 80 },
                {
                  title: '小计',
                  dataIndex: 'subtotal',
                  width: 110,
                  render: (value: number) => formatAmount(value),
                },
              ]}
            />

            <Typography.Paragraph style={{ textAlign: 'right', marginBottom: 0 }}>
              合计：<strong>{formatAmount(detailOrder.totalAmount)}</strong>（共 {detailOrder.itemCount} 件）
            </Typography.Paragraph>
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="取消订单"
        open={Boolean(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
        onOk={() => void confirmCancel()}
        okText="确认取消"
        cancelText="返回"
        confirmLoading={updatingId === cancelTarget?.id}
      >
        <Typography.Paragraph type="secondary">
          取消后商品库存将自动回滚，该操作会记录在订单上。
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          maxLength={255}
          placeholder="取消原因（可选）"
          value={cancelReason}
          onChange={(event) => setCancelReason(event.target.value)}
        />
      </Modal>
    </Card>
  )
}

export default function MallOrderManagementPage() {
  return <MallOrderManagementPageInner />
}
