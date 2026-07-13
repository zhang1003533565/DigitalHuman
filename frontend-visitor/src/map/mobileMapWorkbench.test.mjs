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
  assert.equal(workbench.shouldShowMobileMapClearAction(0), false)
  assert.equal(workbench.shouldShowMobileMapClearAction(2), true)
  assert.equal(workbench.shouldShowMobileMapClearAction(0), false, 'an unsubmitted keyword is not a result')
  assert.equal(workbench.shouldShowMobileMapClearAction.length, 1, 'clear visibility only consumes committed result state')
  assert.equal(typeof workbench.isolateMobileMapDialogBackground, 'function')

  {
    const mapMain = { inert: false }
    const desktopSidebar = { inert: false }
    const alreadyInert = { inert: true }
    const restore = workbench.isolateMobileMapDialogBackground([mapMain, desktopSidebar, alreadyInert])
    assert.equal(mapMain.inert, true)
    assert.equal(desktopSidebar.inert, true)
    assert.equal(alreadyInert.inert, true)
    restore()
    assert.equal(mapMain.inert, false, 'cleanup restores interactive background regions')
    assert.equal(desktopSidebar.inert, false, 'cleanup restores every newly isolated region')
    assert.equal(alreadyInert.inert, true, 'cleanup preserves a pre-existing inert state')
  }
  assert.equal(typeof workbench.createMobileMapSearchGenerationGate, 'function')

  function createSearchHarness() {
    const gate = workbench.createMobileMapSearchGenerationGate()
    const markers = []

    return {
      markers,
      startRemote(label) {
        const generation = gate.begin()
        markers.length = 0
        return () => {
          if (gate.isCurrent(generation)) markers.push(label)
        }
      },
      clear() {
        gate.invalidate()
        markers.length = 0
      },
      selectLocal(label) {
        gate.begin()
        markers.length = 0
        markers.push(label)
      },
    }
  }

  {
    const search = createSearchHarness()
    const resolvePending = search.startRemote('pending')
    search.clear()
    resolvePending()
    assert.deepEqual(search.markers, [], 'clear must invalidate a pending remote callback')
  }

  {
    const search = createSearchHarness()
    const resolveA = search.startRemote('A')
    const resolveB = search.startRemote('B')
    resolveB()
    resolveA()
    assert.deepEqual(search.markers, ['B'], 'an out-of-order A callback must not overwrite B')
  }

  {
    const search = createSearchHarness()
    const resolvePending = search.startRemote('pending')
    search.selectLocal('local facility')
    resolvePending()
    assert.deepEqual(search.markers, ['local facility'], 'a local match must invalidate pending remote results')
  }

  console.log('mobile map workbench state contract passed')
} finally {
  rmSync(outDir, { recursive: true, force: true })
}
