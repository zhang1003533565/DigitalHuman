const DEFAULT_QUICK_REPLY = '我先帮您整理，马上详细说明。'
const SENTENCE_END_RE = /[。！？!?；;，,、]/

type SegmentOptions = {
  minChars?: number
  maxChars?: number
  flush?: boolean
}

export function buildQuickGuideReply() {
  return DEFAULT_QUICK_REPLY
}

export function extractSpeakableSegments(text: string, options: SegmentOptions = {}) {
  const minChars = options.minChars ?? 20
  const maxChars = options.maxChars ?? 42
  const segments: string[] = []
  let rest = text

  while (rest.trim().length > 0) {
    const boundary = findBoundary(rest, minChars)
    if (boundary >= minChars) {
      const segment = rest.slice(0, boundary).trim()
      if (segment) {
        segments.push(segment)
      }
      rest = rest.slice(boundary).trimStart()
      continue
    }

    if (rest.length >= maxChars) {
      const segment = rest.slice(0, maxChars).trim()
      if (segment) {
        segments.push(segment)
      }
      rest = rest.slice(maxChars).trimStart()
      continue
    }

    if (options.flush) {
      const segment = rest.trim()
      if (segment) {
        segments.push(segment)
      }
      rest = ''
    }
    break
  }

  return { segments, rest }
}

function findBoundary(text: string, minChars: number) {
  for (let index = minChars - 1; index < text.length; index += 1) {
    if (SENTENCE_END_RE.test(text[index])) {
      return index + 1
    }
  }
  return -1
}
