export type FeedbackSubmitState = {
  comment: string
  submitState: string
  isComposerOpen: boolean
  reloadKey: number
}

export function applyFeedbackSubmitSuccess(current: FeedbackSubmitState): FeedbackSubmitState {
  return {
    comment: '',
    submitState: '感谢反馈，已提交。',
    isComposerOpen: false,
    reloadKey: current.reloadKey + 1,
  }
}

export function applyFeedbackSubmitFailure(current: FeedbackSubmitState): FeedbackSubmitState {
  return {
    ...current,
    submitState: '提交失败，请稍后重试。',
  }
}

export function toggleExpandedRecordKey(current: Set<string>, recordKey: string): Set<string> {
  const next = new Set(current)
  if (next.has(recordKey)) next.delete(recordKey)
  else next.add(recordKey)
  return next
}

export function shouldCommitFeedbackLoad(
  activeGeneration: number,
  requestGeneration: number,
  aborted: boolean,
): boolean {
  return !aborted && activeGeneration === requestGeneration
}

export function formatFeedbackTime(createdAt: string): string {
  if (!createdAt) return '时间未知'
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '时间未知'
  try {
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '时间未知'
  }
}
