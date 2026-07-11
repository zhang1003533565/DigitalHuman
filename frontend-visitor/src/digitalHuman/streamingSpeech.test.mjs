import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  extractSpeakableSegments,
  joinQuickReplyAndAnswer,
  resolveStreamOutcome,
  sanitizeAnswerText,
  sanitizeSpeechText,
  stripDuplicateGreeting,
} from './streamingSpeech.ts'

assert.deepEqual(
  resolveStreamOutcome({ streamError: '主模型不可用，已降级', fullAnswer: '这是回退 token' }),
  { state: 'error', status: '主模型不可用，已降级' },
)

const digitalHumanPageSource = readFileSync(new URL('../pages/DigitalHumanPage.tsx', import.meta.url), 'utf8')
const requestCatchStart = digitalHumanPageSource.indexOf("setStatus('导览请求失败，请确认问答服务和 TTS 服务已启动。')")
const catchOutcomeAssignment = digitalHumanPageSource.indexOf('speechOutcomeRef.current = {', requestCatchStart)
const catchFallbackEnqueue = digitalHumanPageSource.indexOf("enqueueCurrentSpeechSegments(['这次导览请求失败了，请稍后再试。'])", requestCatchStart)
assert.ok(requestCatchStart >= 0)
assert.ok(catchOutcomeAssignment > requestCatchStart)
assert.ok(catchOutcomeAssignment < catchFallbackEnqueue)
assert.match(digitalHumanPageSource.slice(catchOutcomeAssignment, catchFallbackEnqueue), /state:\s*'error'/)
assert.match(digitalHumanPageSource, /parsed\.messageId/)
assert.match(digitalHumanPageSource, /messageId=\{message\.messageId\}/)

assert.deepEqual(
  resolveStreamOutcome({ streamError: '', fullAnswer: '正常回答' }),
  { state: 'success', status: '导览回答已生成，语音正在分段播放。' },
)

const joined = joinQuickReplyAndAnswer('你好呀，灵山很好逛。', '我推荐上午先去灵山大佛。')
assert.equal(joined, '你好呀，灵山很好逛。\n\n我推荐上午先去灵山大佛。')

const emptyQuickReply = joinQuickReplyAndAnswer('', '我推荐上午先去灵山大佛。')
assert.equal(emptyQuickReply, '我推荐上午先去灵山大佛。')

const sanitizedStageDirection = sanitizeSpeechText('（眼角含笑）好的，我来介绍灵山。')
assert.equal(sanitizedStageDirection, '好的，我来介绍灵山。')

const sanitizedMixedStageDirection = sanitizeSpeechText('她眼角含笑地说：灵山很适合上午游览。')
assert.equal(sanitizedMixedStageDirection, '灵山很适合上午游览。')

const sanitizedEmojiSpeech = sanitizeSpeechText('看来咱们已经很有默契了 😊 想聊点什么？')
assert.equal(sanitizedEmojiSpeech, '看来咱们已经很有默契了 想聊点什么？')

const sanitizedMarkdownAnswer = sanitizeAnswerText('当然可以！\n\n---\n\n**《灵山守松人》**\n\n- 松树会说话。')
assert.equal(sanitizedMarkdownAnswer, '当然可以！\n\n《灵山守松人》\n松树会说话。')

const sanitizedMarkdownSpeech = sanitizeSpeechText('**《灵山守松人》**\n\n---\n\n松树会说话。')
assert.equal(sanitizedMarkdownSpeech, '《灵山守松人》 松树会说话。')

const pendingAfterQuickReply = joinQuickReplyAndAnswer('好的，我来帮你写。', '', { pending: true })
assert.equal(pendingAfterQuickReply, '好的，我来帮你写。\n\n...')

const pendingWithoutQuickReply = joinQuickReplyAndAnswer('', '', { pending: true })
assert.equal(pendingWithoutQuickReply, '...')

const duplicateGreeting = stripDuplicateGreeting(
  '你好呀！欢迎来到灵山景区，有什么需要帮忙的吗？',
  '你好呀！很高兴又和你见面啦～😊 今天是想了解灵山景区的游览攻略，还是想听这里的故事？',
)
assert.equal(duplicateGreeting, '今天是想了解灵山景区的游览攻略，还是想听这里的故事？')

const joinedWithoutDuplicateGreeting = joinQuickReplyAndAnswer(
  '你好呀！欢迎来到灵山景区，有什么需要帮忙的吗？',
  '你好呀！很高兴又和你见面啦～😊 今天是想了解灵山景区的游览攻略，还是想听这里的故事？',
)
assert.equal(
  joinedWithoutDuplicateGreeting,
  '你好呀！欢迎来到灵山景区，有什么需要帮忙的吗？\n\n今天是想了解灵山景区的游览攻略，还是想听这里的故事？',
)

const substantiveGreeting = stripDuplicateGreeting('', '你好呀！我推荐上午先去灵山大佛。')
assert.equal(substantiveGreeting, '你好呀！我推荐上午先去灵山大佛。')

const duplicateWelcome = stripDuplicateGreeting(
  '欢迎来到灵山景区，有什么需要帮忙的吗？',
  '欢迎来到灵山景区，今天我推荐先看灵山大佛。',
)
assert.equal(duplicateWelcome, '今天我推荐先看灵山大佛。')

const firstPass = extractSpeakableSegments('灵山胜境很适合上午游览，可以先去灵山大佛。接着去梵宫看演出。', {
  minChars: 20,
})
assert.deepEqual(firstPass.segments, ['灵山胜境很适合上午游览，可以先去灵山大佛。'])
assert.equal(firstPass.rest, '接着去梵宫看演出。')

const progressiveFirstPass = extractSpeakableSegments(
  '灵山清晨的风很轻，沿着湖边慢慢走，会看到山色和水面一点点亮起来，也会听见远处钟声。接着去梵宫看建筑细节，再去灵山大佛前停一停。',
  { minChars: 40, maxChars: 56 },
)
assert.deepEqual(progressiveFirstPass.segments, ['灵山清晨的风很轻，沿着湖边慢慢走，会看到山色和水面一点点亮起来，也会听见远处钟声。'])
assert.equal(progressiveFirstPass.rest, '接着去梵宫看建筑细节，再去灵山大佛前停一停。')

const progressiveLaterPass = extractSpeakableSegments(
  '第一站可以从游客中心出发，沿主路慢慢走到九龙灌浴，再顺着湖边去看梵宫。第二站建议留给灵山大佛，途中可以看看香樟树和远处山影，也可以顺手拍几张湖面的倒影和山色变化，',
  { minChars: 80, maxChars: 96 },
)
assert.deepEqual(progressiveLaterPass.segments, ['第一站可以从游客中心出发，沿主路慢慢走到九龙灌浴，再顺着湖边去看梵宫。第二站建议留给灵山大佛，途中可以看看香樟树和远处山影，也可以顺手拍几张湖面的倒影和山色变化，'])
assert.equal(progressiveLaterPass.rest, '')

const secondPass = extractSpeakableSegments(firstPass.rest, {
  minChars: 20,
  flush: true,
})
assert.deepEqual(secondPass.segments, ['接着去梵宫看演出。'])
assert.equal(secondPass.rest, '')

const longWithoutPunctuation = extractSpeakableSegments('这是一段暂时没有标点但是已经足够长可以提前合成的导览回答并继续准备下一段内容', {
  minChars: 20,
  maxChars: 28,
})
assert.deepEqual(longWithoutPunctuation.segments, ['这是一段暂时没有标点但是已经足够长可以提前合成的导览回答'])
assert.equal(longWithoutPunctuation.rest, '并继续准备下一段内容')

console.log('streamingSpeech tests passed')
