import assert from 'node:assert/strict'
import axios from 'axios'

import { apiClient, getApiProblem } from '../../node_modules/.tmp/client-test/client.js'

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

const originalAdapter = apiClient.defaults.adapter
const originalSessionStorage = globalThis.sessionStorage
const authStorage = new Map([
  ['digitalhuman.visitor.user', JSON.stringify({ token: 'visitor-token-42' })],
])
globalThis.sessionStorage = {
  getItem: (key) => authStorage.get(key) ?? null,
  setItem: (key, value) => authStorage.set(key, value),
  removeItem: (key) => authStorage.delete(key),
  clear: () => authStorage.clear(),
  key: (index) => Array.from(authStorage.keys())[index] ?? null,
  get length() { return authStorage.size },
}

apiClient.defaults.adapter = async (config) => ({
  data: config.headers?.Authorization,
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
})

const authResponse = await apiClient.get('/user/live/status')
assert.equal(authResponse.data, 'Bearer visitor-token-42')

apiClient.defaults.adapter = originalAdapter
if (originalSessionStorage) {
  globalThis.sessionStorage = originalSessionStorage
} else {
  delete globalThis.sessionStorage
}

console.log('api client problem normalization tests passed')
