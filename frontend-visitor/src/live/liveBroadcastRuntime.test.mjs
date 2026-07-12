import assert from 'node:assert/strict'
import {
  createLiveSpeechKey,
  parseLiveGuideStreamData,
  shouldRecoverLiveSpeechAfterSyncFailure,
  shouldDiscardBackgroundLiveSyncResult,
  shouldSkipBackgroundLiveSync,
} from './liveBroadcastRuntime.ts'

assert.deepEqual(parseLiveGuideStreamData('[DONE]'), null)
assert.deepEqual(parseLiveGuideStreamData('{"sessionId":"live-1","token":"回答"}'), { sessionId: 'live-1', token: '回答' })
assert.throws(() => parseLiveGuideStreamData('{"error":"模型繁忙"}'), /模型繁忙/)
assert.notEqual(createLiveSpeechKey(7, 3, 1), createLiveSpeechKey(7, 3, 2), '同版本同条目在新同步代际必须重新播放')
assert.equal(shouldSkipBackgroundLiveSync('poll', true, null), true, '提问期间轮询不得应用快照')
assert.equal(shouldSkipBackgroundLiveSync('visibility-resume', false, 'answer-complete'), true, '恢复同步期间可见性同步不得抢占')
assert.equal(shouldSkipBackgroundLiveSync('poll', false, null), false, '空闲直播允许低频轮询')
assert.equal(shouldRecoverLiveSpeechAfterSyncFailure('poll', true), false, '普通轮询失败不得重置语音键或播放位置')
assert.equal(shouldRecoverLiveSpeechAfterSyncFailure('visibility-resume', true), false, '可见性同步失败不得重启当前语音')
assert.equal(shouldRecoverLiveSpeechAfterSyncFailure('answer-complete', true), true, '回答恢复失败应按旧快照全局位置重新播放')

for (const outcome of ['resolve', 'reject']) {
  let interactionActive = false
  let applied = false
  let phase = 'answering'
  let answerStopped = false
  const settlePoll = () => {
    if (shouldDiscardBackgroundLiveSyncResult('poll', interactionActive)) return
    applied = true
    phase = outcome === 'resolve' ? 'broadcasting' : 'error'
    answerStopped = true
  }

  // poll-start -> ask-start -> poll-resolve/reject
  interactionActive = true
  settlePoll()

  assert.equal(applied, false, `poll ${outcome} after ask must not apply`)
  assert.equal(phase, 'answering', `poll ${outcome} after ask must not change phase`)
  assert.equal(answerStopped, false, `poll ${outcome} after ask must not stop answer playback`)
}

console.log('live broadcast runtime tests passed')
