export function getMobileLiveComments<T>(messages: readonly T[], transientComment: T | null) {
  if (!transientComment) {
    return [...messages]
  }
  return [...messages, transientComment]
}
