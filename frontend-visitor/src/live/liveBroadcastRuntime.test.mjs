import assert from 'node:assert/strict'
import { createLiveSpeechKey, parseLiveGuideStreamData } from './liveBroadcastRuntime.ts'

assert.deepEqual(parseLiveGuideStreamData('[DONE]'), null)
assert.deepEqual(parseLiveGuideStreamData('{"sessionId":"live-1","token":"回答"}'), { sessionId: 'live-1', token: '回答' })
assert.throws(() => parseLiveGuideStreamData('{"error":"模型繁忙"}'), /模型繁忙/)
assert.notEqual(createLiveSpeechKey(7, 3, 1), createLiveSpeechKey(7, 3, 2), '同版本同条目在新同步代际必须重新播放')

console.log('live broadcast runtime tests passed')
