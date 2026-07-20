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

  const transient = { id: 'runtime-thinking', metadata: { position: 9 } }
  const merged = mobileLive.getMobileLiveComments(messages, transient)
  assert.deepEqual(
    merged.map((item) => item.id),
    ['1', '2', '3', '4', '5', '6', '7', '8', 'runtime-thinking'],
    'a transient runtime comment is appended without hiding earlier ordinary messages',
  )
  assert.deepEqual(messages, snapshot, 'merging a transient comment must not mutate message state')
  assert.deepEqual(
    mobileLive.getMobileLiveComments(messages, null).map((item) => item.id),
    ['1', '2', '3', '4', '5', '6', '7', '8'],
    'an absent transient comment keeps the full ordinary conversation available',
  )
  console.log('mobile digital-human live data contract passed')
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
