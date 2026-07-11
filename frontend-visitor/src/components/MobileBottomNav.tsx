import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/home', label: '首页', icon: '⌂' },
  { to: '/modules/digital-human', label: 'AI 导览', icon: '◉' },
  { to: '/routes', label: '路线', icon: '⌁' },
  { to: '/map', label: '地图', icon: '◇' },
  { to: '/profile', label: '我的', icon: '○' },
]

export function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="移动端主导航">
      {ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `mobile-bottom-nav__item${isActive ? ' mobile-bottom-nav__item--active' : ''}`
          }
        >
          <span className="mobile-bottom-nav__icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
