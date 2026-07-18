import assert from 'node:assert/strict'
import { createNarrationController } from './facilityNarrationController.ts'

const flushMicrotasks = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

function controllable() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function installFakeTimers() {
  const originalSetTimeout = globalThis.setTimeout
  const originalClearTimeout = globalThis.clearTimeout
  const timers = new Map()
  let nextId = 1
  globalThis.setTimeout = (callback, delay) => {
    const id = nextId++
    timers.set(id, { callback, delay })
    return id
  }
  globalThis.clearTimeout = (id) => {
    timers.delete(id)
  }
  return {
    timers,
    restore() {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    },
    runNext() {
      const [id, timer] = timers.entries().next().value ?? []
      assert.ok(id, 'expected a scheduled timer')
      timers.delete(id)
      timer.callback()
      return timer.delay
    },
  }
}

const timers = installFakeTimers()
try {
  const plays = []
  const stops = []
  const pending = []
  const controller = createNarrationController({
    delayMs: 2000,
    speakAudio(url) {
      plays.push(url)
      const playback = controllable()
      pending.push(playback)
      return playback.promise
    },
    stopAudio() {
      stops.push('stop')
    },
  })

  controller.start('/narration.mp3')
  assert.deepEqual(plays, ['/narration.mp3'])
  assert.equal(timers.timers.size, 0)

  pending[0].resolve()
  await flushMicrotasks()
  assert.equal(timers.timers.size, 1)
  assert.equal(timers.runNext(), 2000)
  assert.deepEqual(plays, ['/narration.mp3', '/narration.mp3'])

  controller.interrupt()
  assert.equal(stops.length, 1)
  pending[1].resolve()
  await flushMicrotasks()
  assert.equal(timers.timers.size, 0)

  controller.resume()
  assert.deepEqual(plays, ['/narration.mp3', '/narration.mp3', '/narration.mp3'])

  controller.destroy()
  assert.equal(stops.length, 2)
  pending[2].resolve()
  await flushMicrotasks()
  assert.equal(timers.timers.size, 0)
  assert.deepEqual(plays, ['/narration.mp3', '/narration.mp3', '/narration.mp3'])
} finally {
  timers.restore()
}


  const failingTimers = installFakeTimers()
  try {
    const errors = []
    const failedPlayback = controllable()
    const failingController = createNarrationController({
      delayMs: 2000,
      speakAudio() {
        return failedPlayback.promise
      },
      stopAudio() {},
      onError(error) {
        errors.push(error)
      },
    })
    failingController.start('/blocked.mp3')
    failedPlayback.reject(new Error('autoplay blocked'))
    await flushMicrotasks()
    assert.equal(errors.length, 1)
    assert.equal(errors[0].message, 'autoplay blocked')
    assert.equal(failingTimers.timers.size, 0)
  } finally {
    failingTimers.restore()
  }

console.log('facility narration controller tests passed')
