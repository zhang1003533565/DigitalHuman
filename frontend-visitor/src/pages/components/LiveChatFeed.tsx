import { type FormEvent, useEffect, useRef } from 'react'
import { type LiveChatMessage } from '../../live/liveChat'

type LiveChatFeedProps = {
  messages: LiveChatMessage[]
  draft: string
  busy: boolean
  disabled?: boolean
  presenterName?: string
  placeholder?: string
  type?: 'text'
  'aria-label'?: string
  systemActionLabel?: string
  systemActionMessageId?: string
  onDraftChange: (value: string) => void
  onSend: (event: FormEvent) => void
  onRetry: (message: LiveChatMessage) => void
  onSystemAction?: () => void
}

function getInitials(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length === 0) return '?'
  const chars = trimmed.split(/\s+/).slice(0, 2)
  if (chars.length === 1) return chars[0].slice(0, 2).toUpperCase()
  return chars.map((c) => c[0]).join('').toUpperCase()
}

function getAvatarColor(nickname: string): string {
  const colors = [
    '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#6366f1', '#ef4444', '#14b8a6',
  ]
  let hash = 0
  for (let i = 0; i < nickname.length; i++) {
    hash = (hash * 31 + nickname.charCodeAt(i)) >>> 0
  }
  return colors[hash % colors.length]
}

function Avatar({ nickname }: { nickname: string }) {
  const initials = getInitials(nickname)
  const color = getAvatarColor(nickname)
  return (
    <span
      className="live-chat__avatar"
      style={{ background: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function LiveChatFeed({
  messages,
  draft,
  busy,
  disabled = false,
  presenterName,
  placeholder = '发送一条弹幕',
  type = 'text',
  'aria-label': sendAriaLabel = '发送弹幕',
  systemActionLabel,
  systemActionMessageId,
  onDraftChange,
  onSend,
  onRetry,
  onSystemAction,
}: LiveChatFeedProps) {
  const feedRef = useRef<HTMLDivElement | null>(null)
  const nearBottomRef = useRef(true)

  useEffect(() => {
    const feed = feedRef.current
    if (!feed || !nearBottomRef.current) return
    feed.scrollTop = feed.scrollHeight
  }, [messages])

  const updateNearBottom = () => {
    const feed = feedRef.current
    if (!feed) return
    const { scrollTop, clientHeight, scrollHeight } = feed
    nearBottomRef.current = scrollTop + clientHeight >= scrollHeight - 64
  }

  const displayName = presenterName ?? '数字人主播'
  const isLive = messages.some((m) => m.status !== 'failed' && m.status !== 'sending')

  return (
    <section className="live-chat" aria-label="直播弹幕">
      <div className="live-chat__header">
        <div>
          <p>直播互动</p>
          <strong>{displayName} 正在讲解</strong>
        </div>
        {isLive && <span className="live-chat__live-tag" aria-label="直播中">LIVE</span>}
      </div>

      <div
        ref={feedRef}
        className="live-chat__feed"
        aria-live="polite"
        onScroll={updateNearBottom}
      >
        {messages.length ? messages.map((message) => (
          <article
            key={message.id}
            className={`live-chat__message live-chat__message--${message.role} live-chat__message--${message.status}`}
          >
            <div className="live-chat__message-meta">
              <Avatar nickname={message.nickname} />
              <strong>{message.nickname}</strong>
              {message.role === 'host' ? <span>主播</span> : null}
              {message.status === 'sending' ? <em>发送中</em> : null}
              {message.status === 'streaming' ? <em>输入中</em> : null}
            </div>

            <p>
              {message.content || (message.status === 'streaming' ? '' : '')}
            </p>

            {message.status === 'streaming' && message.role === 'host' && !message.content ? (
              <div className="live-chat__typing-dots" aria-label="正在输入">
                <span /><span /><span />
              </div>
            ) : null}

            {message.status === 'failed' && message.role === 'viewer' ? (
              <button
                className="live-chat__retry"
                type="button"
                disabled={disabled || busy}
                onClick={() => onRetry(message)}
              >
                重试
              </button>
            ) : null}

            {message.role === 'system' && message.id === systemActionMessageId && systemActionLabel && onSystemAction ? (
              <button
                className="live-chat__system-action"
                type="button"
                disabled={busy}
                onClick={onSystemAction}
              >
                {systemActionLabel}
              </button>
            ) : null}
          </article>
        )) : (
          <p className="live-chat__empty">
            欢迎进入直播间，发送问题即可与数字人互动。
          </p>
        )}
      </div>

      <form className="live-chat__composer" onSubmit={onSend}>
        <input
          className="live-chat__input"
          type={type}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-label={sendAriaLabel}
        />
        <button
          className="live-chat__send"
          type="submit"
          aria-label={sendAriaLabel}
          disabled={disabled || busy || !draft.trim()}
        >
          <span aria-hidden="true">&#x27A4;</span>
        </button>
      </form>
    </section>
  )
}
