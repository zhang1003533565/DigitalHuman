import axios from 'axios'

import type { ApiProblem } from './contracts'

type ProblemPayload = {
  code?: unknown
  detail?: unknown
  message?: unknown
  traceId?: unknown
}

export const apiClient = axios.create({
  baseURL: '/api',
})

export function getApiProblem(error: unknown): ApiProblem {
  if (axios.isAxiosError<ProblemPayload>(error)) {
    const payload = error.response?.data

    return {
      status: error.response?.status,
      code: typeof payload?.code === 'string' ? payload.code : undefined,
      message:
        (typeof payload?.message === 'string' && payload.message) ||
        (typeof payload?.detail === 'string' && payload.detail) ||
        error.message ||
        '请求失败，请稍后重试',
      traceId: typeof payload?.traceId === 'string' ? payload.traceId : undefined,
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: '请求失败，请稍后重试' }
}
