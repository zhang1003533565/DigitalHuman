import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const source = readFileSync(new URL('./live2dCleanup.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const module = { exports: {} }
new Function('module', 'exports', compiled)(module, module.exports)
const { disposeLive2dResources, releaseLive2dRefs } = module.exports

{
  const calls = []
  const model = { destroy: () => calls.push('destroy-model') }
  const app = {
    stage: { removeChild: (value) => calls.push(value === model ? 'detach-model' : 'detach-other') },
    destroy: (removeView, options) => calls.push(`destroy-app:${removeView}:${options.children}`),
  }

  disposeLive2dResources({ model, app, stopSpeech: () => calls.push('stop-speech') })

  assert.deepEqual(calls, [
    'stop-speech',
    'detach-model',
    'destroy-model',
    'destroy-app:true:false',
  ])
}

{
  const calls = []
  const errors = []
  const model = { destroy: () => { calls.push('destroy-model'); throw new Error('model disposed') } }
  const app = {
    stage: { removeChild: () => { calls.push('detach-model'); throw new Error('not attached') } },
    destroy: () => calls.push('destroy-app'),
  }

  disposeLive2dResources({
    model,
    app,
    stopSpeech: () => { calls.push('stop-speech'); throw new Error('speech disposed') },
    onError: (step) => errors.push(step),
  })

  assert.deepEqual(calls, ['stop-speech', 'detach-model', 'destroy-model', 'destroy-app'])
  assert.deepEqual(errors, ['stop-speech', 'detach-model', 'destroy-model'])
}

{
  const calls = []
  const model = { destroy: () => calls.push('destroy-model') }
  const app = {
    stage: { removeChild: () => calls.push('detach-model') },
    destroy: () => calls.push('destroy-app'),
  }
  const modelRef = { current: model }
  const appRef = { current: app }

  releaseLive2dRefs({
    modelRef,
    appRef,
    stopSpeech: () => {
      assert.equal(modelRef.current, null)
      assert.equal(appRef.current, null)
      calls.push('stop-speech')
    },
  })

  assert.equal(modelRef.current, null)
  assert.equal(appRef.current, null)
  assert.deepEqual(calls, ['stop-speech', 'detach-model', 'destroy-model', 'destroy-app'])
}

console.log('live2d cleanup tests passed')
