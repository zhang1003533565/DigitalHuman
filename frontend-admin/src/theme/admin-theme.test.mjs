import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  ADMIN_THEME_STORAGE_KEY,
  isAdminThemeMode,
  resolveAdminTheme,
} from './adminTheme.ts'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('auto theme uses the agreed 07:00 to 19:00 day window', () => {
  assert.equal(resolveAdminTheme('auto', new Date(2026, 6, 15, 6, 59)), 'dark')
  assert.equal(resolveAdminTheme('auto', new Date(2026, 6, 15, 7, 0)), 'light')
  assert.equal(resolveAdminTheme('auto', new Date(2026, 6, 15, 18, 59)), 'light')
  assert.equal(resolveAdminTheme('auto', new Date(2026, 6, 15, 19, 0)), 'dark')
})

test('manual modes override time and invalid persisted values are rejected', () => {
  assert.equal(resolveAdminTheme('light', new Date(2026, 6, 15, 23, 0)), 'light')
  assert.equal(resolveAdminTheme('dark', new Date(2026, 6, 15, 12, 0)), 'dark')
  assert.equal(isAdminThemeMode('auto'), true)
  assert.equal(isAdminThemeMode('light'), true)
  assert.equal(isAdminThemeMode('dark'), true)
  assert.equal(isAdminThemeMode('sepia'), false)
  assert.equal(ADMIN_THEME_STORAGE_KEY, 'digital-human.admin-theme-mode')
})

test('provider, shared switch and both consumers are wired', () => {
  const provider = read('./AdminThemeProvider.tsx')
  const themeSwitch = read('../components/AdminThemeSwitch.tsx')
  const main = read('../main.tsx')
  const app = read('../App.tsx')
  const topbar = read('../components/AdminTopbar.tsx')
  const sidebar = read('../components/AdminSidebar.tsx')
  const knowledge = read('../pages/KnowledgeOpenApiPage.tsx')

  assert.match(provider, /localStorage\.getItem\(ADMIN_THEME_STORAGE_KEY\)/)
  assert.match(provider, /localStorage\.setItem\(ADMIN_THEME_STORAGE_KEY,\s*mode\)/)
  assert.match(provider, /document\.documentElement\.dataset\.adminTheme\s*=\s*effectiveTheme/)
  assert.match(provider, /useLayoutEffect\(\(\) => \{[\s\S]*dataset\.adminTheme/)
  assert.match(provider, /if \(nextMode === 'auto'\)[\s\S]*setClock\(new Date\(\)\)[\s\S]*setModeState\(nextMode\)/)
  assert.match(provider, /setInterval\([\s\S]*60_000/)
  assert.match(provider, /clearInterval/)
  assert.match(provider, /darkAlgorithm/)
  assert.match(provider, /defaultAlgorithm/)
  assert.match(main, /<AdminThemeProvider>[\s\S]*<BrowserRouter>/)
  assert.match(themeSwitch, /自动/)
  assert.match(themeSwitch, /日间/)
  assert.match(themeSwitch, /夜间/)
  assert.match(themeSwitch, /aria-label="主题模式"/)
  assert.match(app, /<AdminThemeSwitch/)
  assert.match(topbar, /<AdminThemeSwitch/)
  assert.match(sidebar, /effectiveTheme === 'dark' \? 'dark' : 'light'/)
  assert.match(sidebar, /<AdminThemeSwitch block/)
  assert.match(knowledge, /rootClassName="mkb-config-drawer-root"/)
})

test('cockpit stylesheet exposes complete day and night theme surfaces', () => {
  const css = read('../admin-cockpit.css')

  assert.match(css, /html\[data-admin-theme='dark'\]/)
  assert.match(css, /html\[data-admin-theme='light'\]/)
  assert.match(css, /\.admin-theme-switch/)
  assert.doesNotMatch(css, /\.admin-theme-switch\s*\{[^}]*color-mix/is)
  assert.match(css, /\.login-top-actions/)
  assert.match(css, /\.admin-page-frame\s+\.ai-page__header/)
  assert.match(css, /data-admin-theme='light'[\s\S]*\.admin-sider/)
  assert.match(css, /data-admin-theme='light'[\s\S]*\.admin-topbar/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.ai-page/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.model-action-mode/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.spot-cat/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.fac-list/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.default-accounts b/)
  assert.match(css, /data-admin-theme='light'[\s\S]*\.mkb-knowledge-page/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.admin-theme-switch/)
  assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.default-accounts[\s\S]*display:\s*none/)
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.qa-records-workbench[\s\S]*min-width:\s*0/)
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.fac-list__table-card[\s\S]*overflow:\s*hidden/)
  assert.match(css, /data-admin-theme='light'[\s\S]*\.admin-nav-drawer \.ant-drawer-body/)
  assert.match(css, /data-admin-theme='light'[\s\S]*\.qa-session-drawer[\s,{]/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.mkb-config-drawer-root/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.mkb-paragraph-edit-modal \.ant-modal-content/)
  assert.match(css, /data-admin-theme='dark'[\s\S]*\.mkb-edit-dialog/)
  assert.doesNotMatch(css, /\.admin-theme-switch--compact b\s*\{\s*display:\s*none/)
  assert.match(css, /\.admin-theme-switch--compact b\s*\{[\s\S]*clip-path:\s*inset\(50%\)/)
  assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*\.mkb-edit-dialog[\s\S]*grid-template-columns:\s*1fr/)
  assert.match(css, /\.mkb-editor-toolbar\s*\{[^}]*overflow-x:\s*auto/)
})
