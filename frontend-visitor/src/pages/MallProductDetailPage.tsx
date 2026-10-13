import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { discountRate, fetchMallProduct, type MallProduct } from '../api/mall'
import { getApiProblem } from '../api/client'
import { clampQuantity, MAX_QUANTITY_PER_ITEM, useCartStore } from '../mall/cartStore'
import { MallShell } from '../mall/MallShell'
import { MallIcon } from '../mall/MallIcon'
import { ProductImage } from '../mall/ProductImage'
import { useWishlistStore } from '../mall/wishlistStore'
import './MallPage.css'

const formatAmount = (value: number) => `¥${Number(value ?? 0).toFixed(2)}`

export function MallProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  return <MallShell><ProductDetail key={id} id={id} /></MallShell>
}

function ProductDetail({ id }: { id?: string }) {
  const [product, setProduct] = useState<MallProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState('')
  const addItem = useCartStore((state) => state.addItem)
  const ids = useWishlistStore((state) => state.ids)
  const toggleFavorite = useWishlistStore((state) => state.toggle)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    if (!id) return
    void fetchMallProduct(id).then((data) => { if (active) setProduct(data) })
      .catch((loadError) => { if (active) setError(getApiProblem(loadError).message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading && id) return <div className="mall-detail-page"><nav className="mall-breadcrumb" aria-label="面包屑"><Link to="/mall">返回商城</Link><span>/</span><span>商品详情</span></nav><div className="mall-status" role="status"><strong>正在准备你的下一件好物…</strong></div></div>
  if (error || !product) return <div className="mall-detail-page"><nav className="mall-breadcrumb" aria-label="面包屑"><Link to="/mall">返回商城</Link></nav><article className="mall-status"><MallIcon name="box" /><strong>{error || '商品不存在或已下架'}</strong><p>回到商城，发现其他值得带回家的好物。</p><Link className="mall-btn" to="/mall">返回商城 <MallIcon name="arrow" /></Link></article></div>

  const soldOut = product.stock <= 0
  const maxQuantity = clampQuantity(MAX_QUANTITY_PER_ITEM, product.stock)
  const rate = discountRate(product)
  const savedAmount = rate > 0 ? Number(product.originalPrice) - Number(product.price) : 0
  const favorited = ids.includes(product.id)
  const tags = (product.tags ?? '').split(',').map((tag) => tag.trim()).filter(Boolean)

  function handleAdd() {
    if (!product || soldOut) return false
    const existing = useCartStore.getState().items.find((item) => item.productId === product.id)?.quantity ?? 0
    if (existing >= maxQuantity) { setNotice('购物袋内数量已达库存或购买上限'); return false }
    const addedQuantity = Math.min(quantity, maxQuantity - existing)
    addItem({ ...product, price: Number(product.price) }, addedQuantity)
    setNotice(`已加入购物袋：${product.name} × ${addedQuantity}`)
    return true
  }

  return (
    <div className="mall-detail-page">
      <nav className="mall-breadcrumb" aria-label="面包屑"><Link to="/mall">返回商城</Link><span>/</span><Link to={`/mall?category=${product.category}`}>{product.categoryLabel}</Link><span>/</span><span aria-current="page">{product.name}</span></nav>
      <div className="mall-detail">
        <div className="mall-detail__media"><ProductImage src={product.image} name={product.name} eager />{rate > 0 ? <span className="mall-card__label mall-card__label--sale">−{Math.round(rate * 100)}%</span> : null}</div>
        <div className="mall-detail__body">
          <span className="mall-eyebrow">{product.category === 'farm' ? 'TASTE OF THE LAND' : 'THE DAJINGMEN COLLECTION'} / {product.categoryLabel}</span>
          <h1 className="mall-detail__name">{product.name}</h1>
          <p className="mall-detail__summary">{product.summary || '一件好物，一份来自大境门的心意。'}</p>
          <div className="mall-price"><span className={`mall-price__current${rate > 0 ? ' mall-price__current--sale' : ''}`}>{formatAmount(product.price)}</span>{rate > 0 ? <><span className="mall-price__original">{formatAmount(Number(product.originalPrice))}</span><span className="mall-detail__save">立省 {formatAmount(savedAmount)}</span></> : null}</div>
          <p className="mall-detail__stock"><span className="mall-stock-dot" />{soldOut ? '暂时售罄 · 敬请期待补货' : `现货 ${product.stock} ${product.unit || '件'}${product.stock <= 10 ? ' · 数量有限' : ''}`}</p>
          <div className="mall-detail__quantity"><span>选购数量{product.unit ? ` / ${product.unit}` : ''}</span><div className="mall-qty"><button type="button" aria-label="减少数量" disabled={soldOut || quantity <= 1} onClick={() => setQuantity((current) => Math.max(1, current - 1))}>−</button><span className="mall-qty__value">{quantity}</span><button type="button" aria-label="增加数量" disabled={quantity >= maxQuantity} onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}>+</button></div></div>
          <div className="mall-detail__buy"><button type="button" className="mall-btn" disabled={soldOut} onClick={handleAdd}>{soldOut ? '已售罄' : '加入购物袋'} <MallIcon name="bag" /></button><button type="button" className="mall-btn mall-btn--ghost" disabled={soldOut} onClick={() => { if (handleAdd()) navigate('/mall?checkout=1') }}>立即购买 <MallIcon name="arrow" /></button></div>
          <button type="button" className="mall-detail__favorite" aria-pressed={favorited} onClick={() => toggleFavorite(product.id)}><MallIcon name="heart" filled={favorited} />{favorited ? '已收藏 · 取消收藏' : '收藏这件好物'}</button>
          {notice ? <p className="mall-detail__notice" role="status">{notice} <Link className="mall-text-button" to="/mall?bag=1">查看购物袋</Link></p> : null}
          <details className="mall-detail-accordion" open><summary>商品故事与详情 <MallIcon name="chevron" /></summary><p>{product.description || '商家暂未补充更多商品详情。'}</p>{tags.length > 0 ? <div className="mall-detail__tags">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div> : null}</details>
          <details className="mall-detail-accordion"><summary>配送与订单 <MallIcon name="chevron" /></summary><p>提交订单时填写收货人和联系方式。配送地址与自提安排可在配送信息中说明，具体安排以商家确认结果为准。<br />订单提交后，可在「我的订单」中查看状态；待处理订单支持取消。</p></details>
          {product.updatedAt ? <p className="mall-detail__updated">价格与库存更新于 {product.updatedAt.replace('T', ' ').slice(0, 16)}</p> : null}
        </div>
      </div>
      <div className="mall-detail-caption"><span>LOCAL ROOTS. EVERYDAY STORIES.</span><Link className="mall-text-link" to={`/mall?category=${product.category}`}>继续探索{product.categoryLabel} <MallIcon name="arrow" /></Link></div>
    </div>
  )
}

export default MallProductDetailPage
