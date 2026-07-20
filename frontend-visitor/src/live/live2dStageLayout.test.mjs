import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outputDirectory = mkdtempSync(join(tmpdir(), 'live2d-stage-layout-'))

try {
  execFileSync('npx', [
    'tsc',
    join(root, 'live2dStageLayout.ts'),
    '--ignoreConfig',
    '--outDir', outputDirectory,
    '--target', 'es2023',
    '--module', 'esnext',
    '--moduleResolution', 'bundler',
    '--skipLibCheck',
  ], { stdio: 'inherit' })

  const { resolveLive2dStageLayout } = await import(pathToFileURL(join(outputDirectory, 'live2dStageLayout.js')))
  const assertCloseTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`)

  const mobile = resolveLive2dStageLayout({
    stageWidth: 390,
    stageHeight: 640,
    modelWidth: 1000,
    modelHeight: 1600,
    scaleMultiplier: 0.9,
    xOffsetRatio: 0,
    yOffsetRatio: 0.06,
  })
  assertCloseTo(mobile.scale, 0.351)
  assertCloseTo(mobile.x, 19.5)
  assertCloseTo(mobile.y, 38.4)

  const desktop = resolveLive2dStageLayout({
    stageWidth: 1200,
    stageHeight: 700,
    modelWidth: 1000,
    modelHeight: 1600,
    scaleMultiplier: 0.9,
  })
  assertCloseTo(desktop.scale, 0.39375)
  assertCloseTo(desktop.x, 403.125)
  assertCloseTo(desktop.y, 56)
  assert.ok(desktop.scale > mobile.scale)

  const guarded = resolveLive2dStageLayout({
    stageWidth: 0,
    stageHeight: Number.NaN,
    modelWidth: 0,
    modelHeight: -1,
  })
  assert.ok(Number.isFinite(guarded.scale) && guarded.scale > 0)
  assert.ok(Number.isFinite(guarded.x))
  assert.ok(Number.isFinite(guarded.y))

  console.log('live2d stage layout contract passed')
} finally {
  rmSync(outputDirectory, { recursive: true, force: true })
}
