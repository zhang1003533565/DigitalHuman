import axios from 'axios'

export type RankedItem = { label: string; count: number }
export type ServiceHealthItem = { name: string; status: string; message: string }
export type OperationsOverview = {
  visitorCount: number
  sessionCount: number
  messageCount: number
  successRate: number
  knowledgeHitRate: number
  averageRating: number
  popularQuestions: RankedItem[]
  popularRoutes: RankedItem[]
  serviceHealth: ServiceHealthItem[]
}

export type FeedbackStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED'
export type FeedbackCategory = 'GENERAL' | 'CONTEXTUAL' | 'CONTENT' | 'ROUTE' | 'SERVICE'
export type FeedbackRecord = {
  id: number
  sessionId?: string
  traceId?: string
  routeId?: string
  messageId?: number
  question: string
  answer?: string
  helpful: boolean
  rating: number
  comment?: string
  status: FeedbackStatus
  category: FeedbackCategory
  adminNote?: string
  createdAt: string
}

export const getOperationsOverview = async () =>
  (await axios.get<OperationsOverview>('/api/admin/operations/overview')).data

export const getFeedback = async () =>
  (await axios.get<FeedbackRecord[]>('/api/admin/guide/feedback')).data

export const updateFeedback = async (id: number, payload: Pick<FeedbackRecord, 'status' | 'category' | 'adminNote'>) =>
  (await axios.patch<FeedbackRecord>(`/api/admin/guide/feedback/${id}`, payload)).data
