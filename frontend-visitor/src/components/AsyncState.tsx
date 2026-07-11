import type { ReactNode } from 'react'

type AsyncStateProps = {
  isLoading?: boolean
  error?: string | null
  isEmpty?: boolean
  emptyMessage?: string
  children: ReactNode
}

export function AsyncState({
  isLoading = false,
  error,
  isEmpty = false,
  emptyMessage = '暂无可展示内容，请稍后再来看看。',
  children,
}: AsyncStateProps) {
  if (isLoading) {
    return <p className="hp-async-state" role="status">正在加载首页内容…</p>
  }

  if (error) {
    return <p className="hp-async-state hp-async-state--error" role="alert">{error}</p>
  }

  if (isEmpty) {
    return <p className="hp-async-state">{emptyMessage}</p>
  }

  return <>{children}</>
}
