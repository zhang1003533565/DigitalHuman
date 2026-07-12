import assert from 'node:assert/strict'
import axios from 'axios'

import { getApiProblem } from '../../node_modules/.tmp/client-test/client.js'

const response = {
  status: 503,
  data: {},
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

console.log('api client problem normalization tests passed')
