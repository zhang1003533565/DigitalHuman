import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { discountRate, fetchMallProducts, MALL_CATEGORY_FILTERS, MALL_SORT_OPTIONS, sortMallProducts, type MallProduct, type MallSortKey } from '../api/mall'
import { getApiProblem } from '../api/client'
import { clampQuantity, MAX_QUANTITY_PER_ITEM, useCartStore } from '../mall/cartStore'
import { MallShell } from '../mall/MallShell'
import { MallIcon } from '../mall/MallIcon'
import { ProductImage } from '../mall/ProductImage'
import { useWishlistStore } from '../mall/wishlistStore'
import './MallPage.css'

const DEBOUNCE_MS = 300
const LOW_STOCK_THRESHOLD = 10
const formatAmount = (value: number) => `¥${Number(value ?? 0).toFixed(2)}`

function parsePriceBound(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100) / 100
}

function MallCatalog() {
  const [params, setParams] = useSearchParams()
  const requestedCategory = params.get('category') ?? 'all'
  const activeCategory = MALL_CATEGORY_FILTERS.some((item) => item.value === requestedCategory) ? requestedCategory : 'all'
  const favoritesOnly = params.get('favorites') === '1'
  const [products, setProducts] = useState<MallProduct[]>([])
  const [keyword, setKeyword] = useState(params.get('q') ?? '')
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword)
  const [minPriceInput, setMinPriceInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [debouncedPrice, setDebouncedPrice] = useState<{ min: number | null; max: number | null }>({ min: null, max: null })
  const [sortKey, setSortKey] = useState<MallSortKey>('default')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [compactGrid, setCompactGrid] = useState(false)
  const ids = useWishlistStore((state) => state.ids)
  const toggleFavorite = useWishlistStore((state) => state.toggle)
  const addItem = useCartStore((state) => state.addItem)
  const syncCartWithCatalog = useCartStore((state) => state.syncWithCatalog)
  const catalogRef = useRef<HTMLElement>(null)
  const requestRef = useRef(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [keyword])
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrice({ min: parsePriceBound(minPriceInput), max: parsePriceBound(maxPriceInput) })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [minPriceInput, maxPriceInput])
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const loadProducts = useCallback(async (category: string, search: string, price: { min: number | null; max: number | null }) => {
    const request = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const data = await fetchMallProducts({ category, keyword: search, minPrice: price.min, maxPrice: price.max })
      if (request !== requestRef.current) return
      setProducts(data)
      syncCartWithCatalog(data)
    } catch (loadError) {
      if (request === requestRef.current) setError(getApiProblem(loadError).message)
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [syncCartWithCatalog])

  useEffect(() => {
    // Defer the initial loading update; cancelled renders must not launch a request.
    const timer = setTimeout(() => void loadProducts(activeCategory, debouncedKeyword, debouncedPrice), 0)
    return () => { clearTimeout(timer); requestRef.current += 1 }
  }, [activeCategory, debouncedKeyword, debouncedPrice, loadProducts])

  const visibleProducts = useMemo(() => sortMallProducts(products, sortKey), [products, sortKey])
  const resultCount = favoritesOnly ? products.filter((product) => ids.includes(product.id)).length : products.length
  const hasFilter = activeCategory !== 'all' || debouncedKeyword.trim().length > 0 || debouncedPrice.min != null || debouncedPrice.max != null || favoritesOnly
  const collectionTitle = favoritesOnly ? '我的收藏' : activeCategory === 'farm' ? '地方风味' : activeCategory === 'souvenir' ? '文创生活' : '精选好物'

  function applyCategory(value: string) {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete('category'); else next.set('category', value)
    setParams(next, { replace: true })
  }
  function resetFilters() {
    setKeyword(''); setMinPriceInput(''); setMaxPriceInput('')
    setParams({}, { replace: true })
  }
  function explore(category: string) {
    setKeyword('')
    setMinPriceInput('')
    setMaxPriceInput('')
    setParams(category === 'all' ? {} : { category }, { replace: true })
    catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  function handleAdd(product: MallProduct) {
    if (product.stock <= 0) { setNotice(`${product.name} 已售罄`); return }
    const existing = useCartStore.getState().items.find((item) => item.productId === product.id)?.quantity ?? 0
    if (existing >= clampQuantity(MAX_QUANTITY_PER_ITEM, product.stock)) { setNotice('购物袋内数量已达库存或购买上限'); return }
    addItem({ ...product, price: Number(product.price) }, 1)
    setNotice(`已将「${product.name}」加入购物袋`)
  }

  return (
    <>
      <section className="mall-hero" aria-label="大境门精选好物">
        <img src="/home/great_wall_village.jpg" alt="晨光中的长城与古朴村落" className="mall-hero-image" fetchPriority="high" />
        <div className="mall-hero-shade" />
        <div className="mall-hero-content"><span className="mall-eyebrow">THE DAJINGMEN EDIT / 风物精选</span><h1>把一座城，<br />带进日常<span>。</span></h1><p>从山野风味到匠心文创，<br className="mall-mobile-break" />收藏属于大境门的生活灵感。</p><button type="button" className="mall-btn mall-btn--white" onClick={() => explore('all')}>探索精选好物 <MallIcon name="arrow" /></button></div>
        <div className="mall-hero-bottom"><span>LOCAL ROOTS. EVERYDAY STORIES.</span><span>中国 · 张家口 · 大境门 <span aria-hidden="true">↗</span></span></div>
      </section>
      <div className="mall-collection-strip"><span>一份心意，一段旅程。</span><button type="button" onClick={() => explore('farm')}>尝一口地方风味 <MallIcon name="arrow" /></button><button type="button" onClick={() => explore('souvenir')}>带走一份大境记忆 <MallIcon name="arrow" /></button></div>
      <section className="mall-catalog" ref={catalogRef} id="mall-catalog" aria-labelledby="mall-catalog-title">
        <div className="mall-section-heading"><div><span className="mall-eyebrow">CURATED FOR YOU</span><h2 id="mall-catalog-title">{collectionTitle}<span className="mall-section-count">{loading ? '…' : String(resultCount).padStart(2, '0')}</span></h2></div><p>值得发现，也值得带回家。</p></div>
        <div className="mall-catalog-toolbar">
          <button type="button" className="mall-filter-toggle" aria-expanded={filtersOpen} aria-controls="mall-filters" onClick={() => setFiltersOpen(!filtersOpen)}><MallIcon name="filter" />{filtersOpen ? '收起筛选' : '筛选商品'}{hasFilter ? <span className="mall-filter-dot" /> : null}</button>
          <span className="mall-results-count" role="status" aria-live="polite">{loading ? '正在更新商品…' : `${resultCount} 件${hasFilter ? '符合条件的' : '精选'}商品`}</span>
          <label className="mall-sort"><span>排序</span><select className="mall-sort__select" value={sortKey} aria-label="商品排序" onChange={(event) => setSortKey(event.target.value as MallSortKey)}>{MALL_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          <div className="mall-grid-options" role="group" aria-label="商品网格布局"><button type="button" className={!compactGrid ? 'is-active' : ''} aria-label="四列商品布局" aria-pressed={!compactGrid} onClick={() => setCompactGrid(false)}><span className="mall-grid-symbol mall-grid-symbol--four" /></button><button type="button" className={compactGrid ? 'is-active' : ''} aria-label="三列商品布局" aria-pressed={compactGrid} onClick={() => setCompactGrid(true)}><span className="mall-grid-symbol" /></button></div>
        </div>
        <div className="mall-catalog-layout">
          <aside className={`mall-sidebar${filtersOpen ? ' mall-sidebar--open' : ''}`} id="mall-filters" aria-label="商品筛选">
            <div className="mall-filter-section"><h3>商品分类 <span>CATEGORY</span></h3><div className="mall-category-filters">{MALL_CATEGORY_FILTERS.map((category) => <button key={category.value} type="button" className={`mall-filter${activeCategory === category.value ? ' mall-filter--active' : ''}`} aria-pressed={activeCategory === category.value} onClick={() => applyCategory(category.value)}>{category.label}<span aria-hidden="true">{activeCategory === category.value ? '−' : '+'}</span></button>)}</div></div>
            <div className="mall-filter-section"><h3>寻找好物 <span>SEARCH</span></h3><label className="mall-inline-search"><input type="search" placeholder="输入商品关键词" aria-label="筛选商品关键词" value={keyword} onChange={(event) => setKeyword(event.target.value)} maxLength={120} /><MallIcon name="search" /></label></div>
            <div className="mall-filter-section"><h3>价格区间 <span>PRICE / ¥</span></h3><div className="mall-price-filter"><input type="number" min={0} step="0.01" inputMode="decimal" placeholder="最低价" aria-label="最低价" value={minPriceInput} onChange={(event) => setMinPriceInput(event.target.value)} /><span>—</span><input type="number" min={0} step="0.01" inputMode="decimal" placeholder="最高价" aria-label="最高价" value={maxPriceInput} onChange={(event) => setMaxPriceInput(event.target.value)} /></div></div>
            <div className="mall-filter-section"><button type="button" className="mall-wishlist-filter" aria-pressed={favoritesOnly} onClick={() => { const next = new URLSearchParams(params); if (favoritesOnly) next.delete('favorites'); else next.set('favorites', '1'); setParams(next, { replace: true }) }}><MallIcon name="heart" filled={favoritesOnly} />只看我的收藏 <span>{ids.length}</span></button>{hasFilter ? <button type="button" className="mall-text-button mall-reset" onClick={resetFilters}>清除筛选条件</button> : null}</div>
            <div className="mall-sidebar-note"><span>FROM HERE,<br />WITH LOVE.</span><p>一方风物，<br />一份有温度的心意。</p></div>
          </aside>
          <div className="mall-products" aria-label="商品列表" aria-busy={loading}>
            {loading ? <div className="mall-grid mall-skeleton" aria-label="正在加载商品">{Array.from({ length: 8 }, (_, index) => <div className="mall-skeleton__card" key={index} />)}</div> : error ? <article className="mall-status"><MallIcon name="box" /><strong>好物暂时未能加载</strong><p>{error}</p><button type="button" className="mall-btn" onClick={() => void loadProducts(activeCategory, debouncedKeyword, debouncedPrice)}>重新加载 <MallIcon name="arrow" /></button></article> : resultCount === 0 ? <article className="mall-status"><MallIcon name={favoritesOnly ? 'heart' : 'search'} /><strong>{favoritesOnly ? '把喜欢的好物，留在这里。' : hasFilter ? '没有找到符合条件的商品' : '好物正在准备中'}</strong><p>{favoritesOnly ? '点击商品上的爱心，收藏你的下一份旅行心意。' : hasFilter ? '试试其他关键词，或调整分类与价格区间。' : '景区商家正在上架新品，稍后再来看看。'}</p>{hasFilter ? <button type="button" className="mall-btn" onClick={resetFilters}>查看全部商品 <MallIcon name="arrow" /></button> : null}</article> : (
              <div className={`mall-grid${compactGrid ? ' mall-grid--three' : ''}`}>
                {visibleProducts.map((product) => {
                  if (favoritesOnly && !ids.includes(product.id)) return null
                  const soldOut = product.stock <= 0
                  const lowStock = !soldOut && product.stock <= LOW_STOCK_THRESHOLD
                  const rate = discountRate(product)
                  const favorited = ids.includes(product.id)
                  return <article key={product.id} className={`mall-card${soldOut ? ' mall-card--sold-out' : ''}`}>
                    <div className="mall-card__visual"><Link className="mall-card__media" to={`/mall/products/${product.id}`} tabIndex={-1}><ProductImage src={product.image} name={product.name} />{soldOut ? <span className="mall-card__veil">已售罄</span> : null}</Link><span className={`mall-card__label${rate > 0 ? ' mall-card__label--sale' : ''}`}>{soldOut ? '补货中' : rate > 0 ? `−${Math.round(rate * 100)}%` : product.category === 'farm' ? '地方风味' : '大境文创'}</span><button type="button" className={`mall-card__favorite${favorited ? ' is-favorite' : ''}`} aria-label={`${favorited ? '取消收藏' : '收藏'} ${product.name}`} aria-pressed={favorited} onClick={() => toggleFavorite(product.id)}><MallIcon name="heart" filled={favorited} /></button><button type="button" className="mall-card__quick-add" disabled={soldOut} onClick={() => handleAdd(product)}>{soldOut ? '已售罄' : '加入购物袋'} <MallIcon name="bag" /></button></div>
                    <div className="mall-card__body"><span className="mall-card__category">{product.categoryLabel}</span><h3 className="mall-card__title"><Link to={`/mall/products/${product.id}`}>{product.name}</Link></h3><p className="mall-card__summary">{product.summary || '来自大境门的精选好物'}</p><div className="mall-price"><span className={`mall-price__current${rate > 0 ? ' mall-price__current--sale' : ''}`}>{formatAmount(product.price)}</span>{rate > 0 ? <span className="mall-price__original">{formatAmount(Number(product.originalPrice))}</span> : null}</div>{lowStock ? <span className="mall-card__stock">仅剩 {product.stock} {product.unit || '件'}</span> : null}</div>
                  </article>
                })}
              </div>
            )}
            {!loading && !error && resultCount > 0 ? <div className="mall-catalog-end"><span>已展示全部 {resultCount} 件好物</span><span>GOOD THINGS TAKE A JOURNEY.</span></div> : null}
          </div>
        </div>
      </section>
      <section className="mall-journal" id="mall-journal"><div className="mall-journal-image"><img src="/home/great_wall_village.jpg" alt="长城脚下的古村落与地方生活" loading="lazy" /></div><div className="mall-journal-copy"><span className="mall-eyebrow">THE LOCAL JOURNAL / 大境故事</span><h2>不止是纪念。<br />也是生活的延续。</h2><p>城墙里的故事，田野间的风味，手作中的温度。<br />在大境门，发现一件好物，也遇见它背后的地方。</p><Link to="/tips" className="mall-text-link">寻找更多旅行灵感 <MallIcon name="arrow" /></Link></div></section>
      {notice ? <div className="mall-toast" role="status"><MallIcon name="check" /><span>{notice}</span><button type="button" className="mall-icon-button" aria-label="关闭提示" onClick={() => setNotice('')}><MallIcon name="close" /></button></div> : null}
    </>
  )
}

export function MallPage() {
  const [params] = useSearchParams()
  return <MallShell><MallCatalog key={params.get('q') ?? ''} /></MallShell>
}

export default MallPage
