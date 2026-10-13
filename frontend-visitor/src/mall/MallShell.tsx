import { useEffect, useState, type ReactNode, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { selectTotalCount, useCartStore } from './cartStore'
import { MallCartDrawer } from './MallCartDrawer'
import { MallDialog } from './MallDialog'
import { MallIcon } from './MallIcon'
import { useWishlistStore } from './wishlistStore'
import '../pages/MallPage.css'

export function MallShell({ children }: { children: ReactNode }) {
  const [params] = useSearchParams()
  const [cartOpen, setCartOpen] = useState(() => params.get('checkout') === '1' || params.get('bag') === '1')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const items = useCartStore((state) => state.items)
  const hydrate = useCartStore((state) => state.hydrate)
  const favorites = useWishlistStore((state) => state.ids)
  const count = selectTotalCount(items)
  const navigate = useNavigate()
  const location = useLocation()
  const category = params.get('category') ?? 'all'

  useEffect(() => { hydrate() }, [hydrate])

  useEffect(() => {
    if (!location.hash) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.hash, location.pathname])

  function closeCart() {
    setCartOpen(false)
    if (params.has('checkout') || params.has('bag')) {
      const next = new URLSearchParams(params)
      next.delete('checkout'); next.delete('bag')
      navigate({ pathname: location.pathname, search: next.toString() }, { replace: true })
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const keyword = String(new FormData(event.currentTarget).get('q') ?? '').trim()
    setSearchOpen(false)
    navigate(`/mall${keyword ? `?q=${encodeURIComponent(keyword)}` : ''}`)
  }

  const navigation = <>
    <Link to="/mall" className={location.pathname === '/mall' && category === 'all' && !params.has('favorites') ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>全部好物 <span>ALL</span></Link>
    <Link to="/mall?category=farm" className={category === 'farm' ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>地方风味 <span>FOOD</span></Link>
    <Link to="/mall?category=souvenir" className={category === 'souvenir' ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>文创生活 <span>LIFESTYLE</span></Link>
    <Link to="/mall#mall-journal" onClick={() => setMenuOpen(false)}>大境故事 <span>JOURNAL</span></Link>
  </>

  const primaryNavigation = <>
    <Link to="/home" className={location.pathname === '/home' ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>首页</Link>
    <Link to="/modules/digital-human" className={location.pathname === '/modules/digital-human' ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>AI 导览</Link>
    <Link to="/routes" className={location.pathname === '/routes' || location.pathname === '/route-recommend' ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>路线推荐</Link>
    <Link to="/map" className={location.pathname === '/map' || location.pathname === '/spot-recommend' ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>景点地图</Link>
    <Link to="/mall" className={location.pathname.startsWith('/mall') ? 'is-active' : ''} onClick={() => setMenuOpen(false)}>景区商城</Link>
  </>

  return (
    <main className="page-shell mall-page">
      <div className="mall-scroll">
        <header className="mall-header">
          <button type="button" className="mall-icon-button mall-menu-toggle" aria-label="商品分类菜单" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><MallIcon name={menuOpen ? 'close' : 'menu'} /></button>
          <Link to="/mall" className="mall-wordmark" aria-label="大境门景区商城首页">DJM<span>.</span><small>大境门 · 精选</small></Link>
          <nav className="mall-nav mall-primary-nav" aria-label="主导航">{primaryNavigation}</nav>
          <div className="mall-header-actions">
            <button type="button" className="mall-icon-button" aria-label="搜索商品" onClick={() => setSearchOpen(true)}><MallIcon name="search" /></button>
            <Link to="/mall?favorites=1" className="mall-icon-button mall-wishlist-link" aria-label={`我的收藏，${favorites.length} 件`}><MallIcon name="heart" />{favorites.length > 0 ? <span className="mall-count">{favorites.length}</span> : null}</Link>
            <Link to="/orders" className="mall-icon-button mall-account-link" aria-label="我的订单"><MallIcon name="user" /></Link>
            <button type="button" className="mall-icon-button mall-bag-button" aria-label={`打开购物袋，${count} 件`} onClick={() => setCartOpen(true)}><MallIcon name="bag" /><span className="mall-count">{count}</span></button>
          </div>
        </header>
        {menuOpen ? <nav className="mall-mobile-menu" aria-label="移动端导航"><div className="mall-mobile-menu__primary">{primaryNavigation}</div><div className="mall-mobile-menu__categories"><span>商城分类</span>{navigation}</div></nav> : null}
        {children}
        <footer className="mall-footer">
          <div className="mall-footer-main"><div><Link to="/mall" className="mall-footer-logo">DJM.</Link><p>让旅途里的美好，成为日常。</p></div><div className="mall-footer-links"><div><span>探索好物</span><Link to="/mall?category=farm">地方风味</Link><Link to="/mall?category=souvenir">文创生活</Link><Link to="/mall?favorites=1">我的收藏</Link></div><div><span>旅行与服务</span><Link to="/orders">我的订单</Link><Link to="/tips">游览贴士</Link><Link to="/feedback">联系与反馈</Link></div><div><span>回到大境门</span><Link to="/home">景区首页</Link><Link to="/map">探索景点</Link><Link to="/routes">发现路线</Link></div></div></div>
          <div className="mall-footer-bottom"><span>大境门智游 · 景区商城</span><span>ZH / CNY ¥</span><span>CURATED IN DAJINGMEN.</span></div>
        </footer>
      </div>
      {cartOpen ? <MallCartDrawer onClose={closeCart} initialCheckout={params.get('checkout') === '1'} /> : null}
      {searchOpen ? <MallDialog label="搜索商品" className="mall-search-dialog" onClose={() => setSearchOpen(false)}><div className="mall-drawer-head"><h2>发现你的下一件好物。</h2><button type="button" className="mall-icon-button" aria-label="关闭搜索" onClick={() => setSearchOpen(false)}><MallIcon name="close" /></button></div><form onSubmit={search} className="mall-search-form"><MallIcon name="search" /><input name="q" aria-label="搜索关键词" placeholder="搜索农产品、文创周边…" defaultValue={params.get('q') ?? ''} maxLength={120} autoFocus /><button type="submit" className="mall-btn">搜索 <MallIcon name="arrow" /></button></form><p className="mall-search-hint">从地方风味，到一份值得收藏的旅行记忆。</p></MallDialog> : null}
    </main>
  )
}
