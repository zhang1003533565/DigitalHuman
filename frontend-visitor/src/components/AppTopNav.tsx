import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import { getStoredUser, type SessionUser } from '../auth/session'

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

function getInitials(name: string): string {
  if (!name) return 'U'
  return name.charAt(0).toUpperCase()
}

export function AppTopNav({ onLogout }: AppTopNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const navigate = useNavigate()
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const user: SessionUser | null = getStoredUser()

  const openDropdown = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setDropdownOpen(true)
  }, [])

  const closeDropdown = useCallback(() => {
    hoverTimer.current = setTimeout(() => setDropdownOpen(false), 200)
  }, [])

  function handleLogoutClick() {
    setDropdownOpen(false)
    onLogout()
  }

  function getDropdownStyle(): React.CSSProperties {
    if (!avatarRef.current) return {}
    const rect = avatarRef.current.getBoundingClientRect()
    return {
      position: 'fixed',
      top: rect.bottom + 10,
      right: window.innerWidth - rect.right,
    }
  }

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
      <div
        className="user-menu"
        onMouseEnter={openDropdown}
        onMouseLeave={closeDropdown}
      >
        <button
          ref={avatarRef}
          className="user-menu__avatar"
          type="button"
          aria-label="用户菜单"
        >
          {getInitials(user?.displayName || user?.username || '')}
        </button>
        {dropdownOpen &&
          createPortal(
            <div
              className="user-menu__dropdown"
              style={getDropdownStyle()}
              onMouseEnter={openDropdown}
              onMouseLeave={closeDropdown}
            >
              <div className="user-menu__header">
                <div className="user-menu__avatar user-menu__avatar--lg">
                  {getInitials(user?.displayName || user?.username || '')}
                </div>
                <div className="user-menu__info">
                  <span className="user-menu__name">{user?.displayName || user?.username}</span>
                  <span className="user-menu__role">{user?.role === 'ADMIN' ? '管理员' : '游客'}</span>
                </div>
              </div>
              <div className="user-menu__divider" />
              <button
                className="user-menu__item"
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  navigate('/profile')
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                个人资料
              </button>
              <button
                className="user-menu__item user-menu__item--danger"
                type="button"
                onClick={handleLogoutClick}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                退出登录
              </button>
            </div>,
            document.body,
          )}
      </div>
    </header>
  )
}
