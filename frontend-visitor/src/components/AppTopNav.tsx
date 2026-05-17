import { Link, NavLink } from 'react-router-dom'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'

const NAV_ITEMS = [
  { to: '/home', label: '首页' },
  { to: DIGITAL_HUMAN_ROUTE, label: '数字人导览' },
  { to: '/routes', label: '路线推荐' },
  { to: '/map', label: '景点地图' },
  { to: '/feedback', label: '反馈记录' },
  { to: '/history', label: '会话历史' },
]

type AppTopNavProps = {
  onLogout: () => void
}

export function AppTopNav({ onLogout }: AppTopNavProps) {
  return (
    <header className="app-topbar">
      <div className="app-topbar__brand">
        <Link to="/home">景区导览服务AI数字人</Link>
      </div>
      <nav className="app-topbar__nav" aria-label="主导航">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `app-topbar__link${isActive ? ' app-topbar__link--active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <button className="ghost-button" type="button" onClick={onLogout}>
        退出登录
      </button>
    </header>
  )
}
