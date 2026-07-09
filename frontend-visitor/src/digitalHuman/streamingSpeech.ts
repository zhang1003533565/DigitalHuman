const SENTENCE_END_RE = /[。！？!?；;，,、]/
const GREETING_KEYWORDS_RE = /(你好|您好|欢迎|很高兴|见面|哈喽|嗨)/
const DUPLICATE_GREETING_PREFIXES = [
  /^\s*(?:你好呀?|您好呀?|哈喽|嗨|hi|hello)[!！。,.，、~～\s]*/i,
  /^\s*(?:很高兴(?:又)?(?:和你)?见面(?:啦|呀)?|很高兴见到你(?:啦|呀)?)[!！。,.，、~～\s😊🙂]*\s*/i,
  /^\s*(?:欢迎(?:来到|回到)?[^。！？!?，,、\n]{0,18})[!！。,.，、~～\s]*/i,
]

type SegmentOptions = {
  minChars?: number
  maxChars?: number
  flush?: boolean
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

export function joinQuickReplyAndAnswer(quickReply: string, answer: string) {
  const cleanQuickReply = quickReply.trim()
  const cleanAnswer = stripDuplicateGreeting(cleanQuickReply, answer)
  if (!cleanQuickReply) {
    return cleanAnswer
  }
  if (!cleanAnswer) {
    return cleanQuickReply
  }
  return `${cleanQuickReply}\n\n${cleanAnswer}`
}

export function stripDuplicateGreeting(quickReply: string, answer: string) {
  let cleanAnswer = answer.trimStart()
  if (!GREETING_KEYWORDS_RE.test(quickReply)) {
    return cleanAnswer
  }

  for (let index = 0; index < 3; index += 1) {
    const before = cleanAnswer
    for (const prefix of DUPLICATE_GREETING_PREFIXES) {
      cleanAnswer = cleanAnswer.replace(prefix, '')
    }
    if (cleanAnswer !== before) {
      cleanAnswer = cleanAnswer.replace(/^[!！。,.，、~～\s😊🙂]+/, '')
    }
    cleanAnswer = cleanAnswer.trimStart()
    if (cleanAnswer === before.trimStart()) {
      break
    }
  }

  return cleanAnswer
}

function findBoundary(text: string, minChars: number) {
  for (let index = minChars - 1; index < text.length; index += 1) {
    if (SENTENCE_END_RE.test(text[index])) {
      return index + 1
    }
  }
  return -1
}
