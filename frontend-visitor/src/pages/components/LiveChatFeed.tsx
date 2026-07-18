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

  return <section className="live-chat" aria-label="直播弹幕">
    <div className="live-chat__header">
      <div>
        <p>直播互动</p>
        <strong>{presenterName ? `${presenterName} 正在讲解` : '数字人主播'}</strong>
      </div>
      <span aria-hidden="true">LIVE</span>
    </div>
    <div ref={feedRef} className="live-chat__feed" aria-live="polite" onScroll={updateNearBottom}>
      {messages.length ? messages.map((message) => (
        <article key={message.id} className={`live-chat__message live-chat__message--${message.role} live-chat__message--${message.status}`}>
          <div className="live-chat__message-meta">
            <strong>{message.nickname}</strong>
            {message.role === 'host' ? <span>主播</span> : null}
            {message.status === 'sending' ? <em>发送中</em> : null}
            {message.status === 'streaming' ? <em>输入中</em> : null}
          </div>
          <p>{message.content || (message.status === 'streaming' ? '正在输入…' : '')}</p>
          {message.status === 'failed' && message.role === 'viewer' ? (
            <button className="live-chat__retry" type="button" disabled={disabled || busy} onClick={() => onRetry(message)}>重试</button>
          ) : null}
          {message.role === 'system' && message.id === systemActionMessageId && systemActionLabel && onSystemAction ? (
            <button className="live-chat__system-action" type="button" disabled={busy} onClick={onSystemAction}>{systemActionLabel}</button>
          ) : null}
        </article>
      )) : <p className="live-chat__empty">欢迎进入直播间，发送问题即可与数字人互动。</p>}
    </div>
    <form className="live-chat__composer" onSubmit={onSend}>
      <input
        className="live-chat__input"
        type={type}
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => onDraftChange(event.target.value)}
      />
      <button className="live-chat__send" type="submit" aria-label={sendAriaLabel} disabled={disabled || busy || !draft.trim()}>
        <span aria-hidden="true">➤</span>
      </button>
    </form>
  </section>
}
