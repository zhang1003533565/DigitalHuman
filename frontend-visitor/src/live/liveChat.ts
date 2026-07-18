export type LiveChatMessageRole = 'viewer' | 'host' | 'system'
export type LiveChatMessageStatus = 'sending' | 'streaming' | 'sent' | 'failed'

export type LiveChatMessage = {
  id: string
  role: LiveChatMessageRole
  nickname: string
  content: string
  createdAt: number
  status: LiveChatMessageStatus
}

export function appendLiveMessage(messages: LiveChatMessage[], message: LiveChatMessage, limit = 100): LiveChatMessage[] {
  return [...messages, message].slice(Math.max(0, messages.length + 1 - limit))
}

export function updateLiveMessage(
  messages: LiveChatMessage[],
  id: string,
  patch: Partial<LiveChatMessage>,
): LiveChatMessage[] {
  const index = messages.findIndex((message) => message.id === id)
  if (index === -1) return messages
  return messages.map((message, currentIndex) => (
    currentIndex === index ? { ...message, ...patch, id: message.id } : message
  ))
}
