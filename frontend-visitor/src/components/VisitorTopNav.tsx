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
]

const USER_NAV_ITEMS = [
  { to: '/tips', label: '游览贴士', icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  },
  { to: '/feedback', label: '反馈记录', icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
        <path d="M8 9h8" />
        <path d="M8 13h5" />
      </svg>
    ),
  },
  { to: '/history', label: '会话历史', icon: (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
]

const USER_MENU_ID = 'visitor-user-menu'
const VIEWPORT_INSET = 12
const MIN_MENU_VIEWPORT_HEIGHT = 88

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
      const preferredTop = rect.bottom + 10
      const availableBelow = window.innerHeight - preferredTop - VIEWPORT_INSET
      const menuTop = availableBelow >= MIN_MENU_VIEWPORT_HEIGHT ? preferredTop : VIEWPORT_INSET
      setDropdownStyle({
        position: 'fixed',
        top: menuTop,
        right: window.innerWidth - rect.right,
        '--visitor-user-menu-top': `${menuTop}px`,
      } as React.CSSProperties)
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
              {USER_NAV_ITEMS.map((item) => {
                const active = item.to === location.pathname
                return (
                  <button
                    key={item.to}
                    className={`visitor-user-menu__item${active ? ' visitor-user-menu__item--active' : ''}`}
                    type="button"
                    aria-current={item.to === location.pathname ? 'page' : undefined}
                    onClick={() => {
                      setDropdownOpen(false)
                      navigate(item.to)
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )
              })}
              <div className="visitor-user-menu__divider" />
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
