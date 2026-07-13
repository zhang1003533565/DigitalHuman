export const MOBILE_LIVE_COMMENT_LIMIT = 5

export const MOBILE_LIVE_QUICK_QUESTIONS = [
  { label: '景点讲解', question: '请为我讲解灵山胜境的核心景点。' },
  { label: '路线推荐', question: '请根据当前时间为我推荐一条游览路线。' },
  { label: '附近服务', question: '请告诉我附近有哪些停车、餐饮和卫生间服务。' },
] as const

export function getRecentMobileLiveComments<T>(messages: readonly T[]) {
  return messages.slice(-MOBILE_LIVE_COMMENT_LIMIT)
}

export function getMobileLiveComments<T>(messages: readonly T[], transientComment: T | null) {
  if (!transientComment) {
    return getRecentMobileLiveComments(messages)
  }
  return [...messages.slice(-(MOBILE_LIVE_COMMENT_LIMIT - 1)), transientComment]
}

export function shouldHideMobileLiveCommentOnShortViewport(commentCount: number, commentIndex: number) {
  return commentCount > 3 && commentIndex < commentCount - 3
}
