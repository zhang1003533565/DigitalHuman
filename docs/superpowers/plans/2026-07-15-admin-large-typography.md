# 管理后台大字号 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为登录页和全部管理后台页面建立统一的大字号排版层级，同时保持桌面与移动端布局稳定。

**Architecture:** 继续以 `admin-cockpit.css` 作为后台视觉覆盖入口，新增语义化排版令牌并集中覆盖公共框架、Ant Design 组件和驾驶舱业务组件。通过现有 Node 结构测试锁定字号下限和禁止全局缩放，再用应用内浏览器读取计算字号、检查全路由溢出和代表页面视觉结果。

**Tech Stack:** React 19、TypeScript、Ant Design 5、CSS、Node test runner、Vite

## Global Constraints

- 不新增第三方依赖。
- 不使用 `zoom`、`transform: scale()` 或浏览器级缩放实现。
- 正文、表格单元格、表单控件和按钮以 `15px` 为基准，长段落正文使用 `16px`。
- 可操作辅助文字不得低于 `13px`，侧栏菜单为 `15px`。
- 页面主标题桌面为 `24px`，移动端为 `22px`。
- 登录页在 390 × 844 下仍保持单屏不可滚动。
- 表格允许容器内横向滚动，但页面根节点不得产生横向溢出。
- 直接在当前 `main` 分支修改，不创建分支。

---

### Task 1: 锁定后台大字号设计契约

**Files:**
- Modify: `frontend-admin/src/theme/admin-theme.test.mjs`
- Modify: `frontend-admin/src/admin-cockpit.css`

**Interfaces:**
- Consumes: `html[data-admin-theme='light'|'dark']` 与现有后台公共类名。
- Produces: `--admin-font-body`、`--admin-font-support`、`--admin-font-menu`、`--admin-font-card-title`、`--admin-font-page-title` 排版令牌。

- [ ] **Step 1: Write the failing test**

在 `cockpit stylesheet exposes complete day and night theme surfaces` 测试中增加以下断言：

```js
assert.match(css, /--admin-font-body:\s*15px/)
assert.match(css, /--admin-font-support:\s*13px/)
assert.match(css, /--admin-font-menu:\s*15px/)
assert.match(css, /--admin-font-page-title:\s*24px/)
assert.match(css, /\.admin-sider__nav \.ant-menu\s*\{[^}]*font-size:\s*var\(--admin-font-menu\)/)
assert.match(css, /\.admin-page-frame__header h1\s*\{[^}]*font-size:\s*var\(--admin-font-page-title\)/)
assert.match(css, /\.admin-shell \.ant-table\s*\{[^}]*font-size:\s*var\(--admin-font-body\)/)
assert.doesNotMatch(css, /\bzoom\s*:/)
assert.doesNotMatch(css, /transform:\s*scale\(/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend-admin && node --test src/theme/admin-theme.test.mjs`

Expected: FAIL because the new typography tokens and component contracts do not exist.

- [ ] **Step 3: Implement typography tokens and shared component sizes**

在 `admin-cockpit.css` 的主题令牌区增加：

```css
:root {
  --admin-font-support: 13px;
  --admin-font-body: 15px;
  --admin-font-longform: 16px;
  --admin-font-menu: 15px;
  --admin-font-card-title: 16px;
  --admin-font-topbar-title: 21px;
  --admin-font-page-title: 24px;
  --admin-line-body: 1.65;
}
```

集中覆盖公共框架和 Ant Design 组件：

```css
.admin-sider__nav .ant-menu { font-size: var(--admin-font-menu); }
.admin-topbar__title { font-size: var(--admin-font-topbar-title); }
.admin-page-frame__header h1 { font-size: var(--admin-font-page-title); }
.admin-page-frame__header p,
.admin-page-frame__header span { font-size: var(--admin-font-support); }
.admin-shell .ant-card-head-title { font-size: var(--admin-font-card-title); }
.admin-shell .ant-table,
.admin-shell .ant-form-item,
.admin-shell .ant-input,
.admin-shell .ant-input-number,
.admin-shell .ant-select,
.admin-shell .ant-btn,
.admin-shell .ant-pagination { font-size: var(--admin-font-body); }
```

同步提高菜单行高、表单控件高度和表格单元格上下内边距，避免大字拥挤。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend-admin && node --test src/theme/admin-theme.test.mjs`

Expected: 4 theme subtests PASS.

### Task 2: 修正驾驶舱、自定义页面和移动端字号层级

**Files:**
- Modify: `frontend-admin/src/admin-cockpit.css`
- Modify: `frontend-admin/src/theme/admin-theme.test.mjs`

**Interfaces:**
- Consumes: Task 1 typography tokens.
- Produces: dashboard, QA, spots, facilities, live, AI, knowledge and settings large-type overrides.

- [ ] **Step 1: Extend the failing test for business and responsive surfaces**

```js
assert.match(css, /\.cockpit-metric span\s*\{[^}]*font-size:\s*var\(--admin-font-support\)/)
assert.match(css, /\.qa-message p\s*\{[^}]*font-size:\s*var\(--admin-font-longform\)/)
assert.match(css, /\.mkb-paragraph-card__body\s*\{[^}]*font-size:\s*var\(--admin-font-longform\)/)
assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*--admin-font-page-title:\s*22px/)
assert.match(css, /@media\s*\(max-width:\s*480px\)[\s\S]*\.login-form[\s\S]*font-size:\s*15px/)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend-admin && node --test src/theme/admin-theme.test.mjs`

Expected: FAIL because business-page and responsive typography overrides are missing.

- [ ] **Step 3: Implement business and mobile typography**

对指标标签、状态列表、排名、QA 消息、景点/直播状态、AI 卡片、知识库段落和设置说明使用 Task 1 令牌。仅装饰性刻度允许 `11px`；所有可操作信息至少 `13px`。

在 768px 与 480px 断点重新定义字号和布局：

```css
@media (max-width: 768px) {
  :root {
    --admin-font-page-title: 22px;
    --admin-font-topbar-title: 19px;
  }
  .admin-mobile-menu { font-size: 15px; }
}

@media (max-width: 480px) {
  .login-form,
  .login-form input,
  .login-form button { font-size: 15px; }
  .login-form__title h2::before { font-size: 26px; }
}
```

必要时增加组件高度与间距，不改变信息架构。

- [ ] **Step 4: Run all static frontend tests**

Run: `cd frontend-admin && node --test src/pages/*.test.mjs src/theme/*.test.mjs`

Expected: all 6 tests PASS.

### Task 3: 双主题与响应式视觉验收

**Files:**
- Modify: `design-qa.md`
- Create: `docs/verification/2026-07-15-admin-large-typography-qa.md`

**Interfaces:**
- Consumes: all typography CSS contracts from Tasks 1 and 2.
- Produces: accepted desktop/mobile browser evidence and final QA record.

- [ ] **Step 1: Verify desktop computed typography**

在应用内浏览器以 1280px 打开 `/admin/dashboard`、`/admin/qa`、`/admin/ai-models` 和 `/admin/knowledge`，读取并确认：

```text
sidebar menu = 15px
page title = 24px
table/form/button >= 15px
supporting actionable text >= 13px
long-form answer/knowledge text >= 16px
document horizontal overflow = 0px
```

- [ ] **Step 2: Verify all routes in both themes**

逐页检查 17 个核心后台路由的 light/dark 状态，确认文字没有被截断、按钮没有折行失效、页面根节点横向溢出为 `0px`。

- [ ] **Step 3: Verify mobile behavior**

以 390 × 844 检查登录页、移动抽屉、总览、QA、设施、直播、知识库和设置：登录页滚动高度等于视口高度；后台页面允许纵向滚动；页面根节点横向溢出为 `0px`。

- [ ] **Step 4: Record QA result**

在 `design-qa.md` 追加大字号验收结果，并创建 `docs/verification/2026-07-15-admin-large-typography-qa.md`。只有浏览器计算字号和溢出检查全部满足标准时写入：

```text
final result: passed
```

- [ ] **Step 5: Run final quality checks**

Run: `cd frontend-admin && npm run lint`

Expected: exit 0 with no warnings.

Run: `cd frontend-admin && npm run build`

Expected: exit 0; existing large-chunk warning is non-blocking.

