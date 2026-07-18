import assert from 'node:assert/strict'
import { appendLiveMessage, updateLiveMessage } from './liveChat.ts'

const existing100 = Array.from({ length: 100 }, (_, index) => ({
  id: `message-${index}`,
  role: index % 2 === 0 ? 'viewer' : 'host',
  nickname: index % 2 === 0 ? '游客' : '主播',
  content: `消息 ${index}`,
  createdAt: index,
  status: 'sent',
}))
const next = { id: 'message-100', role: 'viewer', nickname: '游客', content: '第 101 条', createdAt: 100, status: 'sending' }
const appended = appendLiveMessage(existing100, next)

assert.equal(appended.length, 100)
assert.equal(appended[99].id, next.id)
assert.equal(appended[0].id, 'message-1')
assert.equal(existing100.length, 100)
assert.equal(existing100[0].id, 'message-0')

const messages = [
  { id: 'host-1', role: 'host', nickname: '主播', content: '流式', createdAt: 1, status: 'streaming' },
  { id: 'viewer-1', role: 'viewer', nickname: '游客', content: '失败问题', createdAt: 2, status: 'failed' },
]
const updated = updateLiveMessage(messages, 'host-1', { content: '完整回答', status: 'sent' })

assert.equal(updated[0].content, '完整回答')
assert.equal(updated[0].status, 'sent')
assert.equal(updated[1].status, 'failed')
assert.equal(messages[0].content, '流式')
assert.equal(updateLiveMessage(messages, 'missing', { content: '不会写入' }), messages)

console.log('live chat model tests passed')
