import assert from 'node:assert/strict'
import axios from 'axios'

import { getApiProblem } from '../../node_modules/.tmp/client-test/client.js'

const response = {
  status: 503,
  data: { detail: 'secret database topology and credentials' },
  headers: { 'x-trace-id': 'trace-from-header-42' },
  statusText: 'Service Unavailable',
  config: { headers: {} },
}
const error = new axios.AxiosError('Request failed', 'ERR_BAD_RESPONSE', response.config, undefined, response)

assert.deepEqual(getApiProblem(error), {
  status: 503,
  code: undefined,
  message: '服务暂时不可用，请稍后重试',
  traceId: 'trace-from-header-42',
})

const validationResponse = {
  status: 422,
  data: { message: '游玩时长不符合要求' },
  headers: {},
  statusText: 'Unprocessable Entity',
  config: { headers: {} },
}
const validationError = new axios.AxiosError(
  'Request failed',
  'ERR_BAD_REQUEST',
  validationResponse.config,
  undefined,
  validationResponse,
)
assert.equal(getApiProblem(validationError).message, '游玩时长不符合要求')

console.log('api client problem normalization tests passed')
