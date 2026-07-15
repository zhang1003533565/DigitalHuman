# 管理后台日间 / 夜间主题 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为登录页与全部管理后台页面增加可持久化的自动、日间、夜间主题，并统一两套主题下的组件外观。

**Architecture:** 根级 `AdminThemeProvider` 统一计算模式和最终主题，通过 React Context 提供给复用切换器，同时驱动 Ant Design 算法与根节点数据属性。现有驾驶舱 CSS 改为主题变量和明确的日间 / 夜间覆盖，页面功能组件无需维护独立主题状态。

**Tech Stack:** React 19、TypeScript、Ant Design 5、CSS、Node test runner、Vite

## Global Constraints

- 不新增第三方依赖。
- 默认模式为 `auto`，07:00（含）至 19:00（不含）为日间。
- 手动主题必须持久化并优先于时间自动判断。
- 登录页和后台必须复用同一主题组件与存储键。
- 全部后台路由必须同时通过日间和夜间浏览器检查。
- 直接在当前 `main` 分支修改，不创建分支。

---

### Task 1: 主题领域模型与 Provider

**Files:**
- Create: `frontend-admin/src/theme/adminTheme.ts`
- Create: `frontend-admin/src/theme/AdminThemeProvider.tsx`
- Test: `frontend-admin/src/theme/admin-theme.test.mjs`
- Modify: `frontend-admin/src/main.tsx`

**Interfaces:**
- Produces: `AdminThemeMode = 'auto' | 'light' | 'dark'`
- Produces: `resolveAdminTheme(mode, date): 'light' | 'dark'`
- Produces: `useAdminTheme(): { mode, effectiveTheme, setMode }`

- [ ] **Step 1: Write the failing test**

Create a Node structural test that requires the three modes, the 07:00 / 19:00 boundary, persistent storage key, timer cleanup, root `data-admin-theme`, Ant Design algorithms, and provider wiring in `main.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/theme/admin-theme.test.mjs`

Expected: FAIL because the theme files and provider wiring do not exist.

- [ ] **Step 3: Write minimal implementation**

Implement pure time resolution in `adminTheme.ts`, then context, persistence, minute refresh and `ConfigProvider` in `AdminThemeProvider.tsx`. Wrap the router in `main.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/theme/admin-theme.test.mjs`

Expected: PASS.

### Task 2: 登录页和后台主题切换入口

**Files:**
- Create: `frontend-admin/src/components/AdminThemeSwitch.tsx`
- Modify: `frontend-admin/src/components/AdminTopbar.tsx`
- Modify: `frontend-admin/src/components/AdminSidebar.tsx`
- Modify: `frontend-admin/src/App.tsx`
- Test: `frontend-admin/src/theme/admin-theme.test.mjs`

**Interfaces:**
- Consumes: `useAdminTheme()`
- Produces: `<AdminThemeSwitch compact?: boolean />`

- [ ] **Step 1: Extend the failing test**

Require a shared switch with “自动 / 日间 / 夜间” options, login-page usage, topbar usage, and theme-aware Ant Design sidebar menu.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/theme/admin-theme.test.mjs`

Expected: FAIL because the shared switch and consumers are missing.

- [ ] **Step 3: Implement the shared control**

Use Ant Design `Segmented` and existing icon library, add accessible labels, place it beside the login language entry and topbar date, and select the sidebar menu algorithm from `effectiveTheme`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/theme/admin-theme.test.mjs`

Expected: PASS.

### Task 3: 两套驾驶舱视觉变量与页面专项修正

**Files:**
- Modify: `frontend-admin/src/admin-cockpit.css`
- Test: `frontend-admin/src/theme/admin-theme.test.mjs`

**Interfaces:**
- Consumes: `html[data-admin-theme='light'|'dark']`
- Produces: complete theme tokens and responsive component states.

- [ ] **Step 1: Extend the failing test**

Require explicit light and dark root selectors, login controls, topbar switch, Ant Design overlay styling, AI model panels, action mode cards, knowledge panels and 390px responsive rules.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/theme/admin-theme.test.mjs`

Expected: FAIL because the two theme blocks and page overrides are incomplete.

- [ ] **Step 3: Implement theme variables and overrides**

Convert the root cockpit variables into dark defaults plus light replacements. Add theme-scoped styles for shell, sider, menu, topbar, cards, tables, forms, drawers, modals, empty states, login page and the screenshot-identified pages.

- [ ] **Step 4: Run all frontend static tests**

Run: `node --test src/pages/*.test.mjs src/theme/*.test.mjs`

Expected: all tests PASS.

### Task 4: 双主题浏览器 QA 与回归验证

**Files:**
- Modify: `design-qa.md`
- Create: `docs/verification/2026-07-15-admin-theme-qa.md`

**Interfaces:**
- Consumes: all admin routes and login page.
- Produces: accepted same-viewport screenshots and a passing QA record.

- [ ] **Step 1: Start or reuse the Vite server**

Run: `npm run dev -- --host 127.0.0.1 --port 5241`

Expected: local admin frontend responds on port 5241.

- [ ] **Step 2: Verify interactions in the in-app browser**

Use the login theme switch to test all three modes, log in, verify the topbar switch, confirm persistence across navigation, and check every admin route in both effective themes.

- [ ] **Step 3: Verify responsive behavior**

At 390 × 844, verify the login page and representative table, configuration, knowledge and live pages have no horizontal overflow and retain usable primary controls.

- [ ] **Step 4: Run build-quality checks**

Run: `npm run lint`

Run: `npm run build`

Expected: both commands exit 0.

- [ ] **Step 5: Record QA result**

Update `design-qa.md` to `final result: passed` only after the light and dark screenshots are inspected, and document route coverage plus any remaining P3 notes in the verification report.
