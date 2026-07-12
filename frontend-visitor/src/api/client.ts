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

const STATUS_MESSAGES: Record<number, string> = {
  400: '请求参数有误，请检查后重试',
  401: '登录状态已失效，请重新登录',
  403: '当前账号无权执行此操作',
  404: '请求的内容不存在或已被移除',
  409: '数据状态已变化，请刷新后重试',
  429: '操作过于频繁，请稍后重试',
  500: '服务暂时不可用，请稍后重试',
  502: '服务暂时不可用，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
  504: '服务响应超时，请稍后重试',
}

const BUSINESS_MESSAGE_STATUSES = new Set([400, 422])

function safeBusinessMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const message = value.trim()
  if (!message || message.length > 200 || /[<>\u0000-\u001f\u007f]/.test(message)) return undefined
  return message
}

export function getApiProblem(error: unknown): ApiProblem {
  if (axios.isAxiosError<ProblemPayload>(error)) {
    const payload = error.response?.data
    const traceHeader = error.response?.headers?.['x-trace-id']
    const status = error.response?.status
    const businessMessage = status && BUSINESS_MESSAGE_STATUSES.has(status)
      ? safeBusinessMessage(payload?.message) ?? safeBusinessMessage(payload?.detail)
      : undefined

    return {
      status,
      code: typeof payload?.code === 'string' ? payload.code : undefined,
      message:
        businessMessage ||
        (status && STATUS_MESSAGES[status]) ||
        (error.code === 'ERR_NETWORK' ? '网络连接失败，请检查网络后重试' : '') ||
        '请求失败，请稍后重试',
      traceId:
        (typeof payload?.traceId === 'string' && payload.traceId) ||
        (typeof traceHeader === 'string' ? traceHeader : undefined),
    }
  }

  if (error instanceof Error) {
    return { message: error.message }
  }

  return { message: '请求失败，请稍后重试' }
}
