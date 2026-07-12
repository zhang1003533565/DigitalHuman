import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getStoredUser, type SessionUser } from '../auth/session'
import { DIGITAL_HUMAN_ROUTE } from '../digitalHuman/shared'
import './VisitorTopNav.css'

type VisitorTopNavProps = { onLogout: () => void }

const VISITOR_NAV_ITEMS = [
  { to: '/home', label: '首页', activeFor: ['/home'] },
  { to: DIGITAL_HUMAN_ROUTE, label: 'AI 导览', activeFor: [DIGITAL_HUMAN_ROUTE] },
  { to: '/routes', label: '路线推荐', activeFor: ['/routes', '/route-recommend'] },
  { to: '/map', label: '景点地图', activeFor: ['/map', '/spot-recommend'] },
  { to: '/tips', label: '游览贴士', activeFor: ['/tips'] },
  { to: '/feedback', label: '反馈记录', activeFor: ['/feedback'] },
  { to: '/history', label: '会话历史', activeFor: ['/history'] },
]

const USER_MENU_ID = 'visitor-user-menu'

function getInitials(name: string): string {
  return name ? name.charAt(0).toUpperCase() : 'U'
}

export function VisitorTopNav({ onLogout }: VisitorTopNavProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const navigate = useNavigate()
  const location = useLocation()
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const avatarRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const shouldFocusActionRef = useRef(false)
  const profileActionRef = useRef<HTMLButtonElement>(null)
  const user: SessionUser | null = getStoredUser()

  const openDropdown = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    if (avatarRef.current) {
      const rect = avatarRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.bottom + 10,
        right: window.innerWidth - rect.right,
      })
    }
    setDropdownOpen(true)
  }, [])

  const closeDropdown = useCallback(() => {
    hoverTimer.current = setTimeout(() => setDropdownOpen(false), 200)
  }, [])

  const toggleDropdown = useCallback(() => {
    if (dropdownOpen) {
      shouldFocusActionRef.current = false
      setDropdownOpen(false)
      return
    }
    shouldFocusActionRef.current = true
    openDropdown()
  }, [dropdownOpen, openDropdown])

  const closeDropdownAndRestoreFocus = useCallback(() => {
    shouldFocusActionRef.current = false
    setDropdownOpen(false)
    avatarRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!dropdownOpen || !shouldFocusActionRef.current) return

    shouldFocusActionRef.current = false
    const frame = requestAnimationFrame(() => profileActionRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [dropdownOpen])

  useEffect(() => {
    if (!dropdownOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!avatarRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setDropdownOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeDropdownAndRestoreFocus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    function handleResize() {
      setDropdownOpen(false)
    }
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', handleResize)
    }
  }, [closeDropdownAndRestoreFocus, dropdownOpen])

  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
  }, [])

  function handleLogoutClick() {
    setDropdownOpen(false)
    onLogout()
  }

  return (
    <header className="visitor-topbar">
      <div className="visitor-topbar__brand">
        <Link to="/home">灵山智游</Link>
      </div>
      <nav className="visitor-topbar__nav" aria-label="主导航">
        {VISITOR_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={() =>
              `visitor-topbar__link${item.activeFor.includes(location.pathname) ? ' visitor-topbar__link--active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="visitor-user-menu" onMouseEnter={openDropdown} onMouseLeave={closeDropdown}>
        <button
          ref={avatarRef}
          className="visitor-user-menu__avatar"
          type="button"
          aria-label="用户菜单"
          aria-expanded={dropdownOpen}
          aria-controls={dropdownOpen ? USER_MENU_ID : undefined}
          onClick={toggleDropdown}
        >
          {getInitials(user?.displayName || user?.username || '')}
        </button>
        {dropdownOpen &&
          createPortal(
            <div
              ref={menuRef}
              id={USER_MENU_ID}
              role="group"
              aria-label="用户操作"
              className="visitor-user-menu__dropdown"
              style={dropdownStyle}
              onMouseEnter={openDropdown}
              onMouseLeave={closeDropdown}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeDropdownAndRestoreFocus()
              }}
            >
              <div className="visitor-user-menu__header">
                <div className="visitor-user-menu__avatar visitor-user-menu__avatar--lg">
                  {getInitials(user?.displayName || user?.username || '')}
                </div>
                <div className="visitor-user-menu__info">
                  <span className="visitor-user-menu__name">{user?.displayName || user?.username}</span>
                  <span className="visitor-user-menu__role">{user?.role === 'ADMIN' ? '管理员' : '游客'}</span>
                </div>
              </div>
              <div className="visitor-user-menu__divider" />
              <button
                ref={profileActionRef}
                className="visitor-user-menu__item"
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
                className="visitor-user-menu__item visitor-user-menu__item--danger"
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
