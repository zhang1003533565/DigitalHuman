import assert from 'node:assert/strict'
import {
  extractSpeakableSegments,
  joinQuickReplyAndAnswer,
  stripDuplicateGreeting,
} from './streamingSpeech.ts'

const joined = joinQuickReplyAndAnswer('你好呀，灵山很好逛。', '我推荐上午先去灵山大佛。')
assert.equal(joined, '你好呀，灵山很好逛。\n\n我推荐上午先去灵山大佛。')

const emptyQuickReply = joinQuickReplyAndAnswer('', '我推荐上午先去灵山大佛。')
assert.equal(emptyQuickReply, '我推荐上午先去灵山大佛。')

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
