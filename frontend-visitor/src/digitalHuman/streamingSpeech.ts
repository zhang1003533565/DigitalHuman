const STRONG_SENTENCE_END_RE = /[。！？!?；;]/
const SOFT_SENTENCE_END_RE = /[，,、]/
const GREETING_KEYWORDS_RE = /(你好|您好|欢迎|很高兴|见面|哈喽|嗨)/
const STAGE_DIRECTION_RE = /[（(【\u005b][^）)】\u005d]*(?:眼角含笑|含笑|微笑|笑着|神态|表情|动作|语气|旁白|低头|抬头|点头|眨眼)[^）)】\u005d]*[）)】\u005d]/gu
const INLINE_STAGE_DIRECTION_RE = /[^。！？!?；;\n]{0,16}(?:眼角含笑|含笑|微笑|笑着|神态|表情|动作|语气|旁白|低头|抬头|点头|眨眼)(?:地说|说道|说|：|:)?/g
const MARKDOWN_RULE_LINE_RE = /^\s*(?:-{3,}|_{3,}|\*{3,})\s*$/gm
const MARKDOWN_HEADING_RE = /^\s{0,3}#{1,6}\s+/gm
const MARKDOWN_LIST_MARKER_RE = /^\s*[-*+]\s+/gm
const MARKDOWN_EMPHASIS_RE = /[*_`]+/g
const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu
const DUPLICATE_GREETING_PREFIXES = [
  /^\s*(?:你好呀?|您好呀?|哈喽|嗨|hi|hello)[!！。,.，、~～\s]*/i,
  /^\s*(?:很高兴(?:又)?(?:和你)?见面(?:啦|呀)?|很高兴见到你(?:啦|呀)?)[!！。,.，、~～\s😊🙂]*\s*/iu,
  /^\s*(?:欢迎(?:来到|回到)?[^。！？!?，,、\n]{0,18})[!！。,.，、~～\s]*/i,
]

type SegmentOptions = {
  minChars?: number
  maxChars?: number
  flush?: boolean
}

export type StreamOutcome = {
  state: 'success' | 'error'
  status: string
}

export function resolveStreamOutcome({ streamError, fullAnswer }: { streamError: string; fullAnswer: string }): StreamOutcome {
  const error = streamError.trim()
  if (error) {
    return { state: 'error', status: error }
  }
  if (fullAnswer.trim()) {
    return { state: 'success', status: '导览回答已生成，语音正在分段播放。' }
  }
  return { state: 'error', status: '当前主智能体暂时不可用，请确认 ai-service 已启动，并在后台完成 CHAT 模型配置。' }
}

export function extractSpeakableSegments(text: string, options: SegmentOptions = {}) {
  const minChars = options.minChars ?? 20
  const maxChars = options.maxChars ?? 42
  const segments: string[] = []
  let rest = text

  while (rest.trim().length > 0) {
    const boundary = findBoundary(rest, minChars, maxChars)
    if (boundary > 0) {
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

type JoinAnswerOptions = {
  pending?: boolean
}

export function joinQuickReplyAndAnswer(quickReply: string, answer: string, options: JoinAnswerOptions = {}) {
  const cleanQuickReply = quickReply.trim()
  const cleanAnswer = sanitizeAnswerText(stripDuplicateGreeting(cleanQuickReply, answer))
  if (!cleanQuickReply) {
    return cleanAnswer || (options.pending ? '...' : '')
  }
  if (!cleanAnswer) {
    if (options.pending) {
      return `${cleanQuickReply}\n\n...`
    }
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
      cleanAnswer = cleanAnswer.replace(/^[!！。,.，、~～\s😊🙂]+/u, '')
    }
    cleanAnswer = cleanAnswer.trimStart()
    if (cleanAnswer === before.trimStart()) {
      break
    }
  }

  return cleanAnswer
}

export function sanitizeSpeechText(text: string) {
  return sanitizeAnswerText(text)
    .replace(EMOJI_RE, '')
    .replace(STAGE_DIRECTION_RE, '')
    .replace(INLINE_STAGE_DIRECTION_RE, '')
    .replace(/\s+/g, ' ')
    .replace(/^[：:，,。！？!?\s]+/, '')
    .trim()
}

export function sanitizeAnswerText(text: string) {
  return text
    .replace(MARKDOWN_RULE_LINE_RE, '')
    .replace(MARKDOWN_HEADING_RE, '')
    .replace(MARKDOWN_LIST_MARKER_RE, '')
    .replace(MARKDOWN_EMPHASIS_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function findBoundary(text: string, minChars: number, maxChars: number) {
  const searchEnd = Math.min(text.length, maxChars)
  for (let index = minChars - 1; index < searchEnd; index += 1) {
    if (STRONG_SENTENCE_END_RE.test(text[index])) {
      return index + 1
    }
  }

  for (let index = minChars - 1; index < searchEnd; index += 1) {
    if (SOFT_SENTENCE_END_RE.test(text[index])) {
      return index + 1
    }
  }

  return -1
}
