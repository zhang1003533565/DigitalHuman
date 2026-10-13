import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createMallOrder } from '../api/mall'
import { getApiProblem } from '../api/client'
import { clampQuantity, MAX_QUANTITY_PER_ITEM, selectTotalAmount, selectTotalCount, useCartStore } from './cartStore'
import { MallDialog } from './MallDialog'
import { MallIcon } from './MallIcon'
import { ProductImage } from './ProductImage'

const PHONE_PATTERN = /^1\d{10}$/
const formatAmount = (value: number) => `¥${Number(value ?? 0).toFixed(2)}`

export function MallCartDrawer({ onClose, initialCheckout = false }: { onClose: () => void; initialCheckout?: boolean }) {
  const { items, removeItem, updateQuantity, clear: clearCart } = useCartStore()
  const [checkoutOpen, setCheckoutOpen] = useState(initialCheckout)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [receiver, setReceiver] = useState({ name: '', phone: '', address: '', remark: '' })
  const totalCount = selectTotalCount(items)
  const totalAmount = selectTotalAmount(items)
  const navigate = useNavigate()

  async function handleSubmitOrder(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setFormError('')
    if (!items.length) { setFormError('购物袋还是空的，先挑几件商品吧'); return }
    if (!receiver.name.trim()) { setFormError('请填写收货人姓名'); return }
    if (!PHONE_PATTERN.test(receiver.phone.trim())) { setFormError('请填写 11 位手机号'); return }
    setSubmitting(true)
    try {
      await createMallOrder({
        receiverName: receiver.name.trim(), receiverPhone: receiver.phone.trim(),
        receiverAddress: receiver.address.trim() || undefined, remark: receiver.remark.trim() || undefined,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      })
      clearCart()
      onClose()
      navigate('/orders')
    } catch (submitError) {
      setFormError(getApiProblem(submitError).message)
    } finally { setSubmitting(false) }
  }

  return (
    <MallDialog label={checkoutOpen ? '填写配送信息' : '购物袋'} className="mall-cart-drawer" busy={submitting} onClose={onClose}>
      <div className="mall-drawer-head">
        <div><span className="mall-eyebrow">YOUR SELECTION</span><h2>{checkoutOpen ? '配送信息' : '购物袋'} <small>({totalCount})</small></h2></div>
        <button type="button" className="mall-icon-button" aria-label="关闭购物袋" disabled={submitting} onClick={onClose}><MallIcon name="close" /></button>
      </div>
      <div className="mall-drawer-body">
        {items.length === 0 ? (
          <div className="mall-cart-empty"><MallIcon name="bag" /><h3>好物，等你发现。</h3><p>购物袋还是空的，去寻找旅途中的心意吧。</p><button type="button" className="mall-btn" onClick={onClose}>继续逛逛 <MallIcon name="arrow" /></button></div>
        ) : (
          <>
            <div className="mall-cart-list">
              {items.map((item) => (
                <article key={item.productId} className="mall-cart-line">
                  <Link to={`/mall/products/${item.productId}`} aria-disabled={submitting} onClick={(event) => { if (submitting) event.preventDefault(); else onClose() }} className="mall-cart-line__image"><ProductImage src={item.image} name={item.name} /></Link>
                  <div className="mall-cart-line__body"><Link to={`/mall/products/${item.productId}`} aria-disabled={submitting} onClick={(event) => { if (submitting) event.preventDefault(); else onClose() }}>{item.name}</Link><span>{formatAmount(item.price)} / {item.unit || '件'}</span>
                    <div className="mall-cart-line__actions"><div className="mall-qty">
                      <button type="button" aria-label={`减少 ${item.name} 数量`} disabled={submitting || item.quantity <= 1} onClick={() => updateQuantity(item.productId, item.quantity - 1)}>−</button>
                      <span className="mall-qty__value">{item.quantity}</span>
                      <button type="button" aria-label={`增加 ${item.name} 数量`} disabled={submitting || item.quantity >= clampQuantity(MAX_QUANTITY_PER_ITEM, item.stock)} onClick={() => updateQuantity(item.productId, item.quantity + 1)}>+</button>
                    </div><button type="button" className="mall-text-button" disabled={submitting} aria-label={`从购物袋移除 ${item.name}`} onClick={() => removeItem(item.productId)}>移除</button></div>
                  </div>
                </article>
              ))}
            </div>
            {checkoutOpen ? (
              <form id="mall-checkout-form" className="mall-checkout" onSubmit={(event) => void handleSubmitOrder(event)}>
                <h3>填写配送信息</h3>
                <fieldset disabled={submitting}>
                  <label className="mall-field"><span>收货人姓名 <em>*</em></span><input className="mall-input" name="name" autoComplete="name" autoFocus required maxLength={50} placeholder="请填写收货人姓名" value={receiver.name} onChange={(event) => setReceiver((value) => ({ ...value, name: event.target.value }))} /></label>
                  <label className="mall-field"><span>手机号 <em>*</em></span><input className="mall-input" name="phone" type="tel" autoComplete="tel" inputMode="numeric" required pattern="1[0-9]{10}" title="请填写 11 位手机号" maxLength={11} placeholder="用于订单联系" value={receiver.phone} onChange={(event) => setReceiver((value) => ({ ...value, phone: event.target.value }))} /></label>
                  <label className="mall-field"><span>收货地址 <small>（可选）</small></span><input className="mall-input" name="address" autoComplete="street-address" maxLength={255} placeholder="配送地址，或在备注中说明自提安排" value={receiver.address} onChange={(event) => setReceiver((value) => ({ ...value, address: event.target.value }))} /></label>
                  <label className="mall-field"><span>订单备注 <small>（可选）</small></span><textarea className="mall-input" name="remark" rows={2} maxLength={255} placeholder="有什么想告诉商家的？" value={receiver.remark} onChange={(event) => setReceiver((value) => ({ ...value, remark: event.target.value }))} /></label>
                </fieldset>
                {formError ? <p className="mall-field-error" role="alert">{formError}</p> : null}
              </form>
            ) : <button type="button" className="mall-text-button mall-cart-clear" onClick={clearCart}>清空购物袋</button>}
          </>
        )}
      </div>
      {items.length > 0 ? <div className="mall-drawer-foot">
        <div className="mall-cart-total"><span>商品合计 <small> / {totalCount} 件</small></span><strong>{formatAmount(totalAmount)}</strong></div>
        <p>订单以提交时的价格与库存为准。</p>
        {checkoutOpen ? <><button type="submit" form="mall-checkout-form" className="mall-btn mall-btn--block" disabled={submitting}>{submitting ? '正在提交订单…' : '提交订单'} <MallIcon name="arrow" /></button><button type="button" className="mall-text-button" disabled={submitting} onClick={() => setCheckoutOpen(false)}>返回购物袋</button></> : <button type="button" className="mall-btn mall-btn--block" onClick={() => setCheckoutOpen(true)}>去结算 <MallIcon name="arrow" /></button>}
      </div> : null}
    </MallDialog>
  )
}
