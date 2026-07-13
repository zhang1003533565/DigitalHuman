import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const sourceRoot = dirname(fileURLToPath(import.meta.url))
const outDir = mkdtempSync(join(tmpdir(), 'digital-human-mobile-live-'))

try {
  execFileSync('npx', [
    'tsc',
    join(sourceRoot, 'mobileLive.ts'),
    join(sourceRoot, 'mobileLive.fixture.ts'),
    '--target', 'ES2022',
    '--module', 'ES2022',
    '--moduleResolution', 'bundler',
    '--ignoreConfig',
    '--skipLibCheck',
    '--outDir', outDir,
  ], { cwd: join(sourceRoot, '..', '..') })

  const modulePath = join(outDir, 'mobileLive.js')
  assert.ok(readFileSync(modulePath, 'utf8').length > 0)
  const mobileLive = await import(pathToFileURL(modulePath))

  assert.equal(mobileLive.MOBILE_LIVE_COMMENT_LIMIT, 5)
  assert.deepEqual(
    mobileLive.MOBILE_LIVE_QUICK_QUESTIONS.map((item) => item.label),
    ['景点讲解', '路线推荐', '附近服务'],
  )

  const messages = Array.from({ length: 8 }, (_, index) => ({
    id: String(index + 1),
    metadata: { position: index + 1 },
  }))
  const snapshot = structuredClone(messages)
  for (const message of messages) {
    Object.freeze(message.metadata)
    Object.freeze(message)
  }
  Object.freeze(messages)

  const recent = mobileLive.getRecentMobileLiveComments(messages)
  assert.deepEqual(recent.map((item) => item.id), ['4', '5', '6', '7', '8'])
  assert.deepEqual(messages, snapshot, 'deriving live comments must not mutate message state')
  console.log('mobile digital-human live data contract passed')
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
