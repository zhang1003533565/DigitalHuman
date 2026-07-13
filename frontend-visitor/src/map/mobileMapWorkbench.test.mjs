import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const source = join(root, 'mobileMapWorkbench.ts')
const outDir = join(tmpdir(), `mobile-map-workbench-${process.pid}`)

try {
  execFileSync('npx', [
    'tsc',
    source,
    '--ignoreConfig',
    '--outDir',
    outDir,
    '--target',
    'es2023',
    '--module',
    'nodenext',
    '--moduleResolution',
    'nodenext',
    '--skipLibCheck',
  ])

  const workbench = await import(
    pathToFileURL(join(outDir, 'mobileMapWorkbench.js'))
  )

  assert.equal(workbench.toggleMobileMapDrawer('collapsed'), 'expanded')
  assert.equal(workbench.toggleMobileMapDrawer('expanded'), 'collapsed')
  assert.equal(workbench.getMobileMapLiveLabel('live'), '在线')
  assert.equal(workbench.getMobileMapLiveLabel('error'), '同步失败')
  assert.equal(workbench.shouldShowMobileMapClearAction('', 0), false)
  assert.equal(workbench.shouldShowMobileMapClearAction('灵山', 0), true)
  assert.equal(workbench.shouldShowMobileMapClearAction('', 2), true)

  console.log('mobile map workbench state contract passed')
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
