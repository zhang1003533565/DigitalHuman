import assert from 'node:assert/strict'
import {
  MODEL_OPTIONS,
  getModelCostumeOptions,
  resolveModelUrl,
} from './shared.ts'

const haru = MODEL_OPTIONS.find((model) => model.id === 'haru_greeter_pro_jp')
assert.ok(haru, 'Haru model should exist')

assert.equal(resolveModelUrl(haru, 'default'), '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json')
assert.equal(resolveModelUrl(haru, 'white'), '/live2d/haru_greeter_pro_jp/haru_greeter_t05_white.model3.json')
assert.deepEqual(getModelCostumeOptions(haru), [
  {
    id: 'default',
    name: '默认服装',
    url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05.model3.json',
  },
  {
    id: 'white',
    name: '白色导览服',
    url: '/live2d/haru_greeter_pro_jp/haru_greeter_t05_white.model3.json',
  },
])

const hiyori = MODEL_OPTIONS.find((model) => model.id === 'hiyori_pro_zh')
assert.ok(hiyori, 'Hiyori model should exist')
assert.equal(resolveModelUrl(hiyori, 'white'), hiyori.url)
assert.deepEqual(getModelCostumeOptions(hiyori), [{ id: 'default', name: '默认服装' }])

console.log('costume tests passed')
