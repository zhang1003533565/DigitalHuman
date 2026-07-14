import axios from 'axios'

export type QaSessionSummary = {
  sessionId: string
  messageCount: number
  knowledgeHitCount: number
  latestQuestion: string
  latestAnswer: string
  createdAt: string
  updatedAt: string
}

export type QaMessage = {
  role: 'user' | 'assistant' | string
  content: string
  timestamp: number
}

export const listQaSessions = async () =>
  (await axios.get<QaSessionSummary[]>('/api/admin/guide/sessions')).data

export const getQaSessionMessages = async (sessionId: string) =>
  (await axios.get<QaMessage[]>(`/api/admin/guide/session/${encodeURIComponent(sessionId)}/messages`)).data
