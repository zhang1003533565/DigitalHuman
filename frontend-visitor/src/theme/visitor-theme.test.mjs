import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  VISITOR_THEME_STORAGE_KEY,
  isVisitorThemeMode,
  resolveVisitorTheme,
} from './visitorTheme.ts'

const provider = readFileSync(new URL('./VisitorThemeProvider.tsx', import.meta.url), 'utf8')
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')

test('visitor auto theme uses the agreed day window', () => {
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 6, 59)), 'dark')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 7, 0)), 'light')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 18, 59)), 'light')
  assert.equal(resolveVisitorTheme('auto', new Date(2026, 6, 20, 19, 0)), 'dark')
})

test('visitor theme is isolated from the admin theme', () => {
  assert.equal(VISITOR_THEME_STORAGE_KEY, 'digital-human.visitor-theme-mode')
  assert.equal(isVisitorThemeMode('auto'), true)
  assert.equal(isVisitorThemeMode('light'), true)
  assert.equal(isVisitorThemeMode('dark'), true)
  assert.equal(isVisitorThemeMode('sepia'), false)
  assert.doesNotMatch(provider, /admin-theme|adminTheme/)
  assert.match(provider, /dataset\.visitorTheme = effectiveTheme/)
  assert.match(provider, /dataset\.visitorThemeMode = mode/)
  assert.match(app, /<VisitorThemeProvider>[\s\S]*<VisitorTopNav[\s\S]*<Outlet \/>/)
})
