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
  assert.equal(
    workbench.MOBILE_MAP_WORKBENCH_MEDIA_QUERY,
    '(max-width: 768px), (max-width: 932px) and (max-height: 520px) and (orientation: landscape)',
  )

  {
    const listeners = new Set()
    const media = {
      matches: true,
      addEventListener(type, listener) {
        assert.equal(type, 'change')
        listeners.add(listener)
      },
      removeEventListener(type, listener) {
        assert.equal(type, 'change')
        listeners.delete(listener)
      },
      emit(matches) {
        this.matches = matches
        for (const listener of listeners) listener({ matches })
      },
    }
    let exits = 0
    const cleanup = workbench.watchMobileMapWorkbenchViewport(media, () => { exits += 1 })
    media.emit(false)
    assert.equal(exits, 1, 'leaving the workbench viewport collapses an expanded drawer')
    media.emit(true)
    assert.equal(exits, 1, 're-entering does not reopen or re-collapse the drawer')
    cleanup()
    media.emit(false)
    assert.equal(exits, 1, 'cleanup detaches the viewport lifecycle listener')
  }

  {
    const media = {
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }
    let exits = 0
    workbench.watchMobileMapWorkbenchViewport(media, () => { exits += 1 })()
    assert.equal(exits, 1, 'mounting expanded outside the workbench collapses immediately')
  }

  function createSelectionHarness() {
    const derived = workbench.createMobileMapSearchDerivedSelection()
    let selected = null
    let cardVisible = false
    return {
      local(value) {
        derived.selectLocal(value)
        selected = value
        cardVisible = true
      },
      manual(value) {
        derived.clear()
        selected = value
        cardVisible = true
      },
      beginSearch() {
        if (derived.beginSearch()) {
          selected = null
          cardVisible = false
        }
      },
      snapshot() { return { selected, cardVisible } },
    }
  }

  {
    const search = createSelectionHarness()
    search.local('local A')
    search.beginSearch()
    assert.deepEqual(search.snapshot(), { selected: null, cardVisible: false }, 'local A is cleared before remote B success')
  }

  {
    const search = createSelectionHarness()
    search.local('local A')
    search.beginSearch()
    assert.deepEqual(search.snapshot(), { selected: null, cardVisible: false }, 'local A is cleared before a remote empty result')
  }

  {
    const search = createSelectionHarness()
    search.manual('manual selection')
    search.beginSearch()
    assert.deepEqual(search.snapshot(), { selected: 'manual selection', cardVisible: true }, 'new searches preserve manual map selections')
  }

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
