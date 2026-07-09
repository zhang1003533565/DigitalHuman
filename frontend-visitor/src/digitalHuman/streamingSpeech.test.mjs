import assert from 'node:assert/strict'
import {
  buildQuickGuideReply,
  extractSpeakableSegments,
} from './streamingSpeech.ts'

const quickReply = buildQuickGuideReply()
assert.ok(quickReply.length <= 30, 'quick reply should stay within 30 Chinese characters')
assert.match(quickReply, /查|看|整理|说明|介绍/, 'quick reply should acknowledge that details are coming')

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
