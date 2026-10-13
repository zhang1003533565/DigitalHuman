import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { cancelMallOrder, fetchMyOrders, type MallOrder } from '../api/mall'
import { getApiProblem } from '../api/client'
import { MallShell } from '../mall/MallShell'
import './MallPage.css'

function formatAmount(value: number) {
  return `¥${Number(value ?? 0).toFixed(2)}`
}

function formatTime(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

/** 订单流转步骤。已取消订单不走进度条，单独用状态标签表达。 */
const ORDER_STEPS = [
  { status: 'PENDING', label: '待处理' },
  { status: 'CONFIRMED', label: '已确认' },
  { status: 'COMPLETED', label: '已完成' },
] as const

const STATUS_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'PENDING', label: '待处理' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' },
] as const

export function MyOrdersPage() {
  const [orders, setOrders] = useState<MallOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setOrders(await fetchMyOrders())
    } catch (loadError) {
      setError(getApiProblem(loadError).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void fetchMyOrders()
      .then((data) => { if (active) setOrders(data) })
      .catch((loadError) => { if (active) setError(getApiProblem(loadError).message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [loadOrders])

  async function handleCancel(order: MallOrder) {
    if (!window.confirm(`确定取消订单 ${order.id} 吗？取消后库存将自动回滚。`)) {
      return
    }
    setCancellingId(order.id)
    setError('')
    try {
      const updated = await cancelMallOrder(order.id)
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)))
    } catch (cancelError) {
      setError(getApiProblem(cancelError).message)
    } finally {
      setCancellingId(null)
    }
  }

  const visibleOrders = useMemo(
    () => (statusFilter === 'all' ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter],
  )

  /** 每个筛选状态下的订单数量，用于在按钮上给出提示。 */
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: orders.length }
    for (const order of orders) {
      result[order.status] = (result[order.status] ?? 0) + 1
    }
    return result
  }, [orders])

  function renderProgress(order: MallOrder) {
    if (order.status === 'CANCELLED') {
      return null
    }
    const activeIndex = ORDER_STEPS.findIndex((step) => step.status === order.status)
    return (
      <ol className="mall-order-steps" aria-label="订单进度">
        {ORDER_STEPS.map((step, index) => {
          const state = index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'todo'
          return (
            <li key={step.status} className={`mall-order-step mall-order-step--${state}`}>
              <span className="mall-order-step__dot" aria-hidden="true" />
              <span className="mall-order-step__label">{step.label}</span>
            </li>
          )
        })}
      </ol>
    )
  }

  return (
    <MallShell>
      <section className="mall-orders-page">
        <nav className="mall-breadcrumb" aria-label="面包屑"><Link to="/mall">返回商城</Link><span>/</span><span aria-current="page">我的订单</span></nav>
        <header className="mall-page__heading">
          <span className="mall-eyebrow">YOUR ORDERS / 旅途中的心意</span>
          <h1>我的订单</h1>
          <p>查看在大境门景区商城的购买记录与订单状态。</p>
        </header>

        {error ? (
          <article className="mall-status" role="alert">
            <strong>操作没能完成</strong>
            <p>{error}</p>
            <button type="button" className="mall-btn" disabled={loading} onClick={() => void loadOrders()}>重新加载订单</button>
          </article>
        ) : null}

        {!loading && orders.length > 0 ? (
          <div className="mall-order-filters" role="group" aria-label="按状态筛选订单">
            {STATUS_FILTERS.map((filter) => {
              const selected = statusFilter === filter.value
              const count = counts[filter.value] ?? 0
              return (
                <button
                  key={filter.value}
                  type="button"
                  className={`mall-filter${selected ? ' mall-filter--active' : ''}`}
                  aria-pressed={selected}
                  onClick={() => setStatusFilter(filter.value)}
                >
                  {filter.label}
                  <span className="mall-order-filters__count">{count}</span>
                </button>
              )
            })}
          </div>
        ) : null}

        {loading ? (
          <article className="mall-status">
            <strong>正在读取订单</strong>
            <p>马上就好，正在同步你的购买记录。</p>
          </article>
        ) : error && orders.length === 0 ? null : orders.length === 0 ? (
          <article className="mall-status">
            <strong>你还没有下过单</strong>
            <p>挑一件景区好物，把这段旅程带回家。</p>
            <Link className="mall-btn" to="/mall">
              去商城逛逛
            </Link>
          </article>
        ) : visibleOrders.length === 0 ? (
          <article className="mall-status">
            <strong>没有该状态的订单</strong>
            <p>换个筛选条件看看，或查看全部订单。</p>
            <button type="button" className="mall-btn mall-btn--soft" onClick={() => setStatusFilter('all')}>
              查看全部订单
            </button>
          </article>
        ) : (
          <div className="mall-order-list">
            {visibleOrders.map((order) => (
              <article key={order.id} className="mall-order-card">
                <div className="mall-order-card__head">
                  <span className="mall-order-card__id">订单号：{order.id}</span>
                  <span className={`mall-order-status mall-order-status--${order.status}`}>
                    {order.statusLabel}
                  </span>
                </div>

                {renderProgress(order)}

                <div className="mall-order-card__meta">
                  <span>下单时间：{formatTime(order.createdAt)}</span>
                  <span>共 {order.itemCount} 件</span>
                  <span>合计 {formatAmount(order.totalAmount)}</span>
                  <span>
                    收货：{order.receiverName} {order.receiverPhone}
                  </span>
                </div>

                <div className="mall-order-card__items">
                  {order.items.map((item) => (
                    <div key={`${item.productId}-${item.quantity}`} className="mall-order-line">
                      <span className="mall-order-line__name">
                        <Link to={`/mall/products/${item.productId}`}>{item.productName}</Link>
                        <span className="mall-order-line__qty"> × {item.quantity}</span>
                      </span>
                      <span>{formatAmount(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                {order.cancelReason ? (
                  <div className="mall-order-card__meta">取消原因：{order.cancelReason}</div>
                ) : null}

                {order.status === 'PENDING' ? (
                  <div className="mall-order-card__actions">
                    <button
                      type="button"
                      className="mall-btn mall-btn--danger"
                      disabled={cancellingId === order.id}
                      onClick={() => void handleCancel(order)}
                    >
                      {cancellingId === order.id ? '取消中…' : '取消订单'}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </MallShell>
  )
}

export default MyOrdersPage
