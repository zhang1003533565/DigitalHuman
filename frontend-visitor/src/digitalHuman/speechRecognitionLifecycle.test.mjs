import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const outDir = mkdtempSync(join(tmpdir(), 'digital-human-speech-lifecycle-'))

try {
  execFileSync('npx', [
    'tsc',
    join(sourceRoot, 'speechRecognitionLifecycle.ts'),
    '--target', 'ES2022',
    '--module', 'ES2022',
    '--moduleResolution', 'bundler',
    '--ignoreConfig',
    '--skipLibCheck',
    '--outDir', outDir,
  ], { cwd: join(sourceRoot, '..', '..') })

  const { invalidateSpeechRecognition } = await import(
    pathToFileURL(join(outDir, 'speechRecognitionLifecycle.js'))
  )

  const generationRef = { current: 3 }
  let runtimeState = 'listening'
  let draft = '发送前草稿'
  const events = []
  const recognition = {
    onresult: null,
    onerror: null,
    onend: null,
    abort() {
      events.push('abort')
      assert.equal(this.onresult, null, 'result handler must be detached before abort')
      assert.equal(this.onerror, null, 'error handler must be detached before abort')
      assert.equal(this.onend, null, 'end handler must be detached before abort')
      assert.equal(recognitionRef.current, null, 'recognition ref must be cleared before abort')
      assert.equal(generationRef.current, 4, 'generation must advance before abort')
    },
    stop() {
      events.push('stop')
    },
  }
  const recognitionRef = { current: recognition }
  const generation = generationRef.current

  recognition.onresult = (transcript) => {
    if (generationRef.current === generation) draft = transcript
  }
  recognition.onerror = () => {
    if (generationRef.current === generation && recognitionRef.current === recognition) runtimeState = 'error'
  }
  recognition.onend = () => {
    if (generationRef.current === generation && recognitionRef.current === recognition) runtimeState = 'idle'
  }

  const staleResult = recognition.onresult
  const staleError = recognition.onerror
  const staleEnd = recognition.onend

  invalidateSpeechRecognition(recognitionRef, generationRef)
  runtimeState = 'thinking'
  draft = ''

  staleEnd()
  staleResult('过期识别结果')
  staleError()

  assert.deepEqual(events, ['abort', 'stop'])
  assert.equal(runtimeState, 'thinking', 'stale recognition events must not overwrite thinking')
  assert.equal(draft, '', 'stale recognition results must not refill the cleared draft')

  const failingRecognition = {
    onresult: () => {},
    onerror: () => {},
    onend: () => {},
    abort() {
      throw new Error('already inactive')
    },
    stop() {
      events.push('fallback-stop')
      throw new Error('already stopped')
    },
  }
  assert.doesNotThrow(
    () => invalidateSpeechRecognition({ current: failingRecognition }, { current: 0 }),
    'browser-specific abort/stop failures must not interrupt the send path',
  )
  assert.equal(events.at(-1), 'fallback-stop', 'stop is still attempted when abort throws')
  console.log('speech recognition lifecycle race contract passed')
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
