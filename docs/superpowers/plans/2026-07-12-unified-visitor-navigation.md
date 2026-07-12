# 游客端统一导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将首页导航提取为游客端唯一顶部导航组件，并用完整菜单替换所有游客页面的旧导航。

**Architecture:** 新建无视觉变体、无页面级菜单参数的 `VisitorTopNav`，组件内部持有唯一菜单配置并复用现有用户下拉交互。所有游客页面只传 `onLogout`，旧 `AppTopNav` 及其 default/home 两套样式被删除。

**Tech Stack:** React 19、TypeScript 6、React Router 7、Vite 8、CSS。

## Global Constraints

- 品牌固定为“灵山智游”。
- 菜单固定为：首页、AI 导览、路线推荐、景点地图、游览贴士、反馈记录、会话历史。
- 保留头像、个人资料、退出登录和当前路由激活状态。
- 保留现有 `MobileBottomNav`，不修改登录页和管理后台。
- 不新增依赖，不修改现有路由路径。
- 所有游客页面不得传入自定义标题、菜单或样式变体。

---

### Task 1: 建立统一导航组件与契约测试

**Files:**
- Create: `frontend-visitor/src/components/VisitorTopNav.tsx`
- Create: `frontend-visitor/src/components/VisitorTopNav.css`
- Create: `frontend-visitor/src/components/VisitorTopNav.test.mjs`
- Delete: `frontend-visitor/src/components/AppTopNav.tsx`
- Delete: `frontend-visitor/src/components/AppTopNav.css`
- Modify: `frontend-visitor/package.json`

**Interfaces:**
- Consumes: `onLogout: () => void`、`getStoredUser()`、React Router `NavLink`。
- Produces: `VisitorTopNav({ onLogout }: { onLogout: () => void })`。

- [ ] **Step 1: 写失败的统一导航契约测试**

```js
const expectedItems = [
  ['/home', '首页'],
  ['/modules/digital-human', 'AI 导览'],
  ['/routes', '路线推荐'],
  ['/map', '景点地图'],
  ['/tips', '游览贴士'],
  ['/feedback', '反馈记录'],
  ['/history', '会话历史'],
]

assert.match(source, /export function VisitorTopNav/)
assert.match(source, /灵山智游/)
for (const [path, label] of expectedItems) {
  assert.ok(source.includes(`to: '${path}'`))
  assert.ok(source.includes(`label: '${label}'`))
}
assert.doesNotMatch(source, /variant|items\?|title\?/)
```

- [ ] **Step 2: 运行测试确认组件尚不存在**

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs`

Expected: FAIL，`VisitorTopNav.tsx` 不存在。

- [ ] **Step 3: 迁移首页导航结构和样式**

实现固定菜单常量和唯一 props：

```ts
type VisitorTopNavProps = { onLogout: () => void }

const VISITOR_NAV_ITEMS = [
  { to: '/home', label: '首页' },
  { to: DIGITAL_HUMAN_ROUTE, label: 'AI 导览' },
  { to: '/routes', label: '路线推荐' },
  { to: '/map', label: '景点地图' },
  { to: '/tips', label: '游览贴士' },
  { to: '/feedback', label: '反馈记录' },
  { to: '/history', label: '会话历史' },
]
```

CSS 只保留首页视觉：64px 紧凑高度、深色背景、宋体品牌、金色激活下划线和紧凑头像；保留用户下拉、`.page-shell`、`.module-screen` 与移动端适配，不保留 `--home` 或默认胶囊激活样式。

- [ ] **Step 4: 删除旧组件并验证契约**

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs`

Expected: PASS，七个菜单完整且没有可变标题、菜单或 variant。

- [ ] **Step 5: 提交组件任务**

Commit intent: `用单一游客导航组件锁定首页视觉与完整菜单`。

---

### Task 2: 替换所有游客页面并清理旧配置

**Files:**
- Modify: `frontend-visitor/src/pages/HomePage.tsx`
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.tsx`
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.tsx`
- Modify: `frontend-visitor/src/pages/MapPage.tsx`
- Modify: `frontend-visitor/src/pages/TravelTipsPage.tsx`
- Modify: `frontend-visitor/src/pages/FeedbackPage.tsx`
- Modify: `frontend-visitor/src/pages/HistoryPage.tsx`
- Modify: `frontend-visitor/src/pages/ProfilePage.tsx`
- Modify: `frontend-visitor/src/pages/SpotRecommendPage.tsx`
- Modify: `frontend-visitor/src/pages/RouteRecommendListPage.tsx`
- Modify: `frontend-visitor/src/components/VisitorTopNav.test.mjs`

**Interfaces:**
- Consumes: Task 1 的 `VisitorTopNav({ onLogout })`。
- Produces: 所有游客页面统一的顶部导航调用。

- [ ] **Step 1: 扩展失败测试覆盖全部页面**

```js
for (const file of routedPages) {
  const page = readFileSync(file, 'utf8')
  assert.match(page, /import \{ VisitorTopNav \}/)
  assert.match(page, /<VisitorTopNav onLogout=\{onLogout\} \/>/)
  assert.doesNotMatch(page, /AppTopNav|HOME_NAV_ITEMS|variant="home"/)
}
```

- [ ] **Step 2: 运行测试确认页面仍引用旧组件**

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs`

Expected: FAIL，至少首页或功能页仍包含 `AppTopNav`。

- [ ] **Step 3: 替换页面调用并删除首页菜单配置**

每个页面统一为：

```tsx
import { VisitorTopNav } from '../components/VisitorTopNav'

<VisitorTopNav onLogout={onLogout} />
```

首页删除 `HOME_NAV_ITEMS`，不再传递 `title`、`items`、`variant`。

- [ ] **Step 4: 运行全量验证**

Run:

```bash
cd frontend-visitor
node src/components/VisitorTopNav.test.mjs
find src -name '*.test.mjs' -print0 | xargs -0 -n1 node
npm run lint
npm run build
rg -n "AppTopNav|HOME_NAV_ITEMS|app-topbar--home|variant=\"home\"" src
```

Expected: 所有测试、Lint、Build 通过；最终 `rg` 无匹配。

- [ ] **Step 5: 提交页面替换任务**

Commit intent: `让所有游客页面复用首页导航并移除旧实现`。
