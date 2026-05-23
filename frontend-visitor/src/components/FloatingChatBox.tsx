import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './FloatingChatBox.css'

export type FloatingChatAction = {
  label: ReactNode
  onClick: () => void
  variant?: 'primary' | 'ghost'
  icon?: ReactNode
  disabled?: boolean
}

export type FloatingChatUser = {
  id: string
  name: ReactNode
  avatar?: ReactNode
  subtitle?: ReactNode
  online?: boolean
  unreadCount?: number
}

export type FloatingChatMessage = {
  id?: string
  senderId?: string
  isOwn?: boolean
  role?: 'me' | 'other'
  avatar?: ReactNode
  name?: ReactNode
  content: ReactNode
  time?: string | number | Date
  status?: 'sending' | 'sent' | 'read' | 'failed'
  canRetry?: boolean
  badge?: ReactNode
  badgeTone?: 'cyan' | 'gold' | 'blue' | 'green' | 'violet'
}

export type FloatingChatStyle = CSSProperties & Record<`--${string}`, string | number>

export type FloatingChatBoxProps = {
  title?: ReactNode
  status?: ReactNode
  users?: FloatingChatUser[]
  activeUserId?: string
  defaultActiveUserId?: string
  rememberSelectedKey?: string
  onActiveUserChange?: (userId: string) => void
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  currentUserId?: string
  messages?: FloatingChatMessage[]
  actions?: FloatingChatAction[]
  onSend?: (content: string, activeUserId: string) => void | Promise<void>
  onRetryMessage?: (message: FloatingChatMessage, activeUserId: string) => void | Promise<void>
  isLoading?: boolean
  isStreaming?: boolean
  inputPlaceholder?: string
  sendLabel?: ReactNode
  className?: string
  style?: FloatingChatStyle
}

const TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

function joinClassNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

function readStorage(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

function formatMessageTime(value?: string | number | Date) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return TIME_FORMATTER.format(date)
}

function getMessageStatusLabel(status?: FloatingChatMessage['status']) {
  switch (status) {
    case 'sending':
      return '发送中'
    case 'sent':
      return '已发送'
    case 'read':
      return '已读'
    case 'failed':
      return '发送失败'
    default:
      return ''
  }
}

function getInitials(value: ReactNode, fallback: string) {
  return typeof value === 'string' ? value.trim().slice(0, 1) || fallback : fallback
}

export function FloatingChatBox({
  users = [],
  activeUserId: activeUserIdProp,
  defaultActiveUserId,
  rememberSelectedKey,
  onActiveUserChange,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  currentUserId = 'me',
  messages = [],
  onSend,
  onRetryMessage,
  isLoading = false,
  isStreaming = false,
  inputPlaceholder = '请输入消息...',
  sendLabel = '发送',
  className,
  style,
}: FloatingChatBoxProps) {
  const initialActiveUserId =
    activeUserIdProp ??
    (rememberSelectedKey ? readStorage(rememberSelectedKey) ?? defaultActiveUserId : defaultActiveUserId) ??
    users[0]?.id ??
    ''

  const [internalActiveUserId, setInternalActiveUserId] = useState(initialActiveUserId)
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  const [draft, setDraft] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [isUsersOpen, setIsUsersOpen] = useState(false)
  const [isMobileUsersOpen, setIsMobileUsersOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const usersMenuRef = useRef<HTMLDivElement | null>(null)
  const hoverTimerRef = useRef<number | null>(null)

  const activeUserId = activeUserIdProp ?? internalActiveUserId
  const isCollapsed = collapsedProp ?? internalCollapsed
  const activeUser = useMemo(
    () => users.find((user) => user.id === activeUserId) ?? users[0] ?? null,
    [activeUserId, users],
  )
  const isBusy = isLoading || isStreaming || isSubmitting
  const canSend = Boolean(onSend) && !isBusy && draft.trim().length > 0

  useEffect(() => {
    if (!users.length) return
    if (activeUserId && users.some((user) => user.id === activeUserId)) return

    const nextActiveUserId = users[0]?.id ?? ''
    if (!nextActiveUserId) return

    if (activeUserIdProp === undefined) {
      setInternalActiveUserId(nextActiveUserId)
    }
    onActiveUserChange?.(nextActiveUserId)
  }, [activeUserId, activeUserIdProp, onActiveUserChange, users])

  useEffect(() => {
    if (rememberSelectedKey && activeUserId) {
      writeStorage(rememberSelectedKey, activeUserId)
    }
  }, [activeUserId, rememberSelectedKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [activeUserId, messages.length, isBusy])

  useEffect(() => {
    setSendError(null)
  }, [activeUserId])

  useEffect(() => {
    if (collapsedProp === undefined) {
      setInternalCollapsed(defaultCollapsed)
    }
  }, [collapsedProp, defaultCollapsed])

  useEffect(() => {
    if (isCollapsed) {
      setIsUsersOpen(false)
      setIsMobileUsersOpen(false)
      return
    }

    function handleClickOutside(event: MouseEvent) {
      if (!usersMenuRef.current?.contains(event.target as Node)) {
        setIsUsersOpen(false)
      }
    }

    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [isCollapsed])

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current)
      }
    }
  }, [])

  function handleSelectUser(userId: string) {
    if (activeUserIdProp === undefined) {
      setInternalActiveUserId(userId)
    }
    setIsUsersOpen(false)
    setIsMobileUsersOpen(false)
    setSendError(null)
    onActiveUserChange?.(userId)
  }

  function handleToggleCollapsed() {
    const nextCollapsed = !isCollapsed
    if (collapsedProp === undefined) {
      setInternalCollapsed(nextCollapsed)
    }
    if (nextCollapsed) {
      setIsUsersOpen(false)
      setIsMobileUsersOpen(false)
    }
    onCollapsedChange?.(nextCollapsed)
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()

    const content = draft.trim()
    if (!content || !onSend || isBusy) return

    setIsSubmitting(true)
    setSendError(null)
    try {
      await onSend(content, activeUserId)
      setDraft('')
    } catch (error) {
      setSendError('发送失败，请稍后重试')
      console.error('Floating chat send failed', error)
    } finally {
      setIsSubmitting(false)
      window.requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }

  async function handleRetry(message: FloatingChatMessage) {
    if (!onRetryMessage || isBusy) return
    try {
      await onRetryMessage(message, activeUserId)
    } catch (error) {
      setSendError('重试失败，请稍后重试')
      console.error('Floating chat retry failed', error)
    }
  }

  function openUsersMenu() {
    if (window.innerWidth < 720) {
      setIsMobileUsersOpen((current) => !current)
      return
    }
    setIsUsersOpen(true)
  }

  function closeUsersMenu() {
    setIsUsersOpen(false)
    setIsMobileUsersOpen(false)
  }

  return (
    <section
      className={joinClassNames('floating-chat', isCollapsed && 'floating-chat--collapsed', className)}
      style={style}
      aria-label="聊天主界面"
      aria-busy={isBusy}
    >
      {isCollapsed ? (
        <button
          type="button"
          className="floating-chat__collapsed-trigger"
          onClick={handleToggleCollapsed}
          aria-label="展开聊天框"
          title="展开聊天框"
        >
          <span className="floating-chat__collapsed-avatar" aria-hidden>
            {activeUser?.avatar ?? getInitials(activeUser?.name, '聊')}
          </span>
          <span className="floating-chat__collapsed-dot" aria-hidden />
          {activeUser?.unreadCount ? (
            <span className="floating-chat__collapsed-unread">{activeUser.unreadCount}</span>
          ) : null}
        </button>
      ) : (
        <>
          <header className="floating-chat__topbar">
            <div
              ref={usersMenuRef}
              className="floating-chat__session-wrap"
              onMouseEnter={() => {
                if (window.innerWidth < 720) return
                if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current)
                setIsUsersOpen(true)
              }}
              onMouseLeave={() => {
                if (window.innerWidth < 720) return
                hoverTimerRef.current = window.setTimeout(() => setIsUsersOpen(false), 120)
              }}
            >
              <button
                type="button"
                className="floating-chat__session"
                onClick={openUsersMenu}
                aria-expanded={isUsersOpen || isMobileUsersOpen}
                aria-haspopup="listbox"
              >
                <span className="floating-chat__session-avatar" aria-hidden>
                  {activeUser?.avatar ?? getInitials(activeUser?.name, '聊')}
                </span>
                <span className="floating-chat__session-body">
                  <span className="floating-chat__session-name-row">
                    <span className="floating-chat__session-name">{activeUser?.name ?? '当前会话'}</span>
                    <span className="floating-chat__session-chevron" aria-hidden>
                      ▾
                    </span>
                  </span>
                  <span className="floating-chat__session-meta">
                    {activeUser?.online ? <span className="floating-chat__status-dot" /> : null}
                    <span>{activeUser?.subtitle ?? '当前会话'}</span>
                    {activeUser?.unreadCount ? (
                      <span className="floating-chat__session-unread">{activeUser.unreadCount}</span>
                    ) : null}
                  </span>
                </span>
              </button>

              {(isUsersOpen || isMobileUsersOpen) && users.length > 0 ? (
                <div className="floating-chat__users-popover" role="listbox" aria-label="会话列表">
                  {users.map((user) => {
                    const isActive = user.id === activeUserId
                    return (
                      <button
                        key={user.id}
                        type="button"
                        className={joinClassNames(
                          'floating-chat__user-option',
                          isActive && 'floating-chat__user-option--active',
                        )}
                        onClick={() => handleSelectUser(user.id)}
                        role="option"
                        aria-selected={isActive}
                      >
                        <span className="floating-chat__user-option-avatar" aria-hidden>
                          {user.avatar ?? getInitials(user.name, '聊')}
                        </span>
                        <span className="floating-chat__user-option-body">
                          <span className="floating-chat__user-option-name">{user.name}</span>
                          <span className="floating-chat__user-option-subtitle">
                            {user.subtitle ?? '暂无描述'}
                          </span>
                        </span>
                        <span className="floating-chat__user-option-meta">
                          {user.online ? <span className="floating-chat__status-dot" /> : null}
                          {user.unreadCount ? (
                            <span className="floating-chat__user-option-unread">{user.unreadCount}</span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                  <button type="button" className="floating-chat__users-close" onClick={closeUsersMenu}>
                    收起列表
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="floating-chat__collapse-btn"
              onClick={handleToggleCollapsed}
              aria-label="收起聊天框"
              title="收起聊天框"
            >
              收起
            </button>
          </header>

          <main className="floating-chat__main">
            <div className="floating-chat__messages" aria-live="polite">
              {messages.length > 0 ? (
                messages.map((message, index) => {
                  const isOwn =
                    message.isOwn ?? (message.role === 'me' || message.senderId === currentUserId)
                  const messageStatus = getMessageStatusLabel(message.status)

                  return (
                    <article
                      key={message.id ?? index}
                      className={joinClassNames(
                        'floating-chat__message',
                        isOwn ? 'floating-chat__message--own' : 'floating-chat__message--other',
                      )}
                    >
                      {!isOwn ? (
                        <span className="floating-chat__message-avatar" aria-hidden>
                          {message.avatar ?? message.badge ?? '对'}
                        </span>
                      ) : null}
                      <div className={joinClassNames('floating-chat__bubble', isOwn && 'floating-chat__bubble--own')}>
                        <div className="floating-chat__bubble-head">
                          <b className="floating-chat__speaker">
                            {message.name ?? (isOwn ? '我' : activeUser?.name ?? '对方')}
                          </b>
                          <span className="floating-chat__time">{formatMessageTime(message.time)}</span>
                        </div>
                        <div className="floating-chat__content">{message.content}</div>
                        <div className="floating-chat__bubble-foot">
                          {messageStatus ? (
                            <span
                              className={joinClassNames(
                                'floating-chat__state',
                                message.status && `floating-chat__state--${message.status}`,
                              )}
                            >
                              {messageStatus}
                            </span>
                          ) : null}
                          {message.status === 'failed' && onRetryMessage && message.canRetry !== false ? (
                            <button
                              type="button"
                              className="floating-chat__retry"
                              onClick={() => void handleRetry(message)}
                            >
                              重试
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isOwn ? (
                        <span className="floating-chat__message-avatar" aria-hidden>
                          {message.avatar ?? message.badge ?? '我'}
                        </span>
                      ) : null}
                    </article>
                  )
                })
              ) : (
                <div className="floating-chat__empty">暂无消息</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {sendError ? <div className="floating-chat__error">{sendError}</div> : null}

          </main>

          <footer className="floating-chat__composer">
            <form className="floating-chat__composer-form" onSubmit={(event) => void handleSubmit(event)}>
              <textarea
                ref={inputRef}
                className="floating-chat__input"
                value={draft}
                placeholder={inputPlaceholder}
                rows={3}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void handleSubmit()
                  }
                }}
                disabled={isBusy || !onSend}
              />
              <button type="submit" className="floating-chat__send" disabled={!canSend}>
                {isBusy ? <span className="floating-chat__spinner" aria-hidden /> : null}
                <span>{sendLabel}</span>
              </button>
            </form>
          </footer>
        </>
      )}
    </section>
  )
}
