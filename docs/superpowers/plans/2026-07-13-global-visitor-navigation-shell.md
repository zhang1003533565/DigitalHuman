# 游客端全局导航壳 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将游客顶部导航提升到认证路由壳中只渲染一次，使首页和所有其他页面拥有完全相同的导航宽度、层级和滚动行为。

**Architecture:** `ProtectedRoute` 渲染唯一 `VisitorTopNav`、内容容器、`Outlet` 和 `MobileBottomNav`；各页面删除导航依赖。全局内容容器控制剩余高度与移动端主滚动，页面根只负责自身正文布局。

**Tech Stack:** React 19、React Router 7、TypeScript 6、CSS、Node.js contract tests、ESLint、Vite 8。

## Global Constraints

- `/home` 顶部导航是唯一视觉与行为基准。
- 登录后的游客页面只能由 `ProtectedRoute` 渲染一个 `VisitorTopNav`。
- `/login` 不显示游客导航。
- 不改变菜单名称、顺序、路由、激活态、头像菜单和退出逻辑。
- 不改变移动底部导航信息架构。
- 不新增依赖。
- 用户要求不打开浏览器；使用测试、Lint 和构建验证。

---

### Task 1: 将导航提升到认证路由壳并移除页面副本

**Files:**
- Modify: `frontend-visitor/src/App.tsx`
- Modify: `frontend-visitor/src/components/VisitorTopNav.test.mjs`
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
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.tsx`

**Interfaces:**
- Produces: `ProtectedRoute` owns `<VisitorTopNav onLogout={onLogout} />` and `<div className="authenticated-app__content"><Outlet /></div>`。
- Produces: routed pages no longer consume `VisitorTopNav`。

- [ ] **Step 1: 写失败的唯一导航契约**

更新 `VisitorTopNav.test.mjs`：读取 `App.tsx`，断言 `ProtectedRoute` 包含且只包含一次 `VisitorTopNav`，导航位于 `Outlet` 外；所有页面断言不再 import/render `VisitorTopNav`。

```js
const appUrl = new URL('../App.tsx', import.meta.url)
const appSource = readFileSync(fileURLToPath(appUrl), 'utf8')
assert.equal((appSource.match(/<VisitorTopNav onLogout=\{onLogout\} \/>/g) ?? []).length, 1)
assert.match(appSource, /<VisitorTopNav onLogout=\{onLogout\} \/>[\s\S]*authenticated-app__content[\s\S]*<Outlet \/>/)
for (const relativePath of routedPages) {
  const page = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
  assert.doesNotMatch(page, /VisitorTopNav/, `${relativePath} must rely on the authenticated shell`)
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs`

Expected: FAIL，`App.tsx` 尚未渲染导航且页面仍包含导航。

- [ ] **Step 3: 实现认证壳唯一导航**

`App.tsx` 导入 `VisitorTopNav`，并把认证壳改为：

```tsx
<div className="authenticated-app">
  <VisitorTopNav onLogout={onLogout} />
  <div className="authenticated-app__content">
    <Outlet />
  </div>
  <MobileBottomNav />
</div>
```

逐页删除 `VisitorTopNav` import 和 JSX，不改变页面 props 或业务逻辑。

- [ ] **Step 4: 运行契约、Lint 和构建**

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs && npm run lint && npm run build`

Expected: 全部退出码 0。

- [ ] **Step 5: 提交结构改动**

```bash
git add frontend-visitor/src/App.tsx frontend-visitor/src/components/VisitorTopNav.test.mjs frontend-visitor/src/pages
git commit -m "refactor: 让认证壳统一持有游客顶部导航"
```

### Task 2: 统一全局内容高度、滚动和页面布局

**Files:**
- Modify: `frontend-visitor/src/App.css`
- Modify: `frontend-visitor/src/components/VisitorTopNav.css`
- Modify: `frontend-visitor/src/components/VisitorTopNav.test.mjs`
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.css`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.css`

**Interfaces:**
- Consumes: Task 1 `.authenticated-app__content`。
- Produces: top navigation full width; content consumes remaining height; mobile content owns vertical scroll and bottom safe area。

- [ ] **Step 1: 写失败的布局契约**

断言：`.authenticated-app` 为纵向 flex；`.authenticated-app__content` 为 `flex: 1 1 auto`、`min-height: 0`、`overflow: hidden`；移动端 content 为 `overflow-y: auto`；删除 `.page-shell:not(.home-page) > .visitor-topbar` 和 `.module-screen > .visitor-topbar` 页面级定位规则。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs && node src/responsive.test.mjs`

Expected: FAIL，全局内容容器样式尚不存在且页面级导航补丁仍存在。

- [ ] **Step 3: 实现全局壳布局**

```css
.authenticated-app {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.authenticated-app__content {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
}

.authenticated-app__content > * {
  height: 100%;
}
```

移动端 `.authenticated-app__content` 使用 `overflow-x: hidden; overflow-y: auto;`，其直接页面根自然高度并统一预留底部导航与安全区。删除导航负 margin 和 module absolute 规则；调整数字人和直播页高度，使它们相对 content 而非完整 viewport。

- [ ] **Step 4: 运行游客端完整验证**

Run: `cd frontend-visitor && for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done && npm run lint && npm run build && git diff --check`

Expected: 全部测试、ESLint、TypeScript 和 Vite build 通过。

- [ ] **Step 5: 提交布局改动**

```bash
git add frontend-visitor/src/App.css frontend-visitor/src/components/VisitorTopNav.css frontend-visitor/src/components/VisitorTopNav.test.mjs frontend-visitor/src/responsive.test.mjs frontend-visitor/src/pages/DigitalHumanPage.css frontend-visitor/src/pages/LiveBroadcastPage.css
git commit -m "fix: 统一全局导航下的页面高度与移动滚动"
```

## 完成标准

- `VisitorTopNav` 在认证壳只渲染一次。
- 所有游客页面不再导入或渲染顶部导航。
- 首页与其他页面导航拥有相同 DOM 父级和全宽行为。
- 页面正文仍保持各自间距和滚动能力。
- AI 导览、直播、地图和路线页面不被顶部或底部导航遮挡。
- 游客端全部测试、ESLint 和生产构建通过。
- 工作树只包含本计划范围内改动。
