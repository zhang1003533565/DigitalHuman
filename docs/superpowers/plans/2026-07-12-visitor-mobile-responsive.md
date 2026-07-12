# 游客端移动适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复游客端五个核心页面在 320–768px 宽度下的裁切、重叠、多重滚动和底部导航遮挡问题。

**Architecture:** 应用壳在移动端拥有唯一主滚动容器并统一预留底部安全区；内容型页面按普通文档流展开，AI 导览和地图只在各自组件内部保留必要的局部滚动。所有变更优先通过现有 CSS 边界完成，不改变路由、数据请求、地图 SDK 和共享导航组件接口。

**Tech Stack:** React 19、TypeScript 6、Vite 8、CSS、Node.js `assert` 静态契约测试。

## Global Constraints

- 不打开浏览器；以用户提供的五张截图和代码规则作为本轮验证依据。
- 保持桌面端视觉、业务逻辑、地图 SDK 初始化和共享导航不变。
- 不新增依赖、路由、图片素材或移动端重复组件。
- 移动端范围为 320–768px，重点覆盖 320、375、390、430、768px。
- 主要触控目标不得小于现有 `--touch-target: 44px`。
- 固定底部导航必须继续支持 `safe-area-inset-bottom`。

---

### Task 1: 锁定移动端单一滚动与安全区契约

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/index.css`
- Modify: `frontend-visitor/src/App.css`

**Interfaces:**
- Consumes: `--mobile-nav-height`、`--safe-bottom`、`--touch-target` CSS 变量。
- Produces: `.authenticated-app` 作为移动端主滚动边界；页面壳统一获得底部安全间距。

- [ ] **Step 1: 写入失败的全局响应式契约测试**

在 `responsive.test.mjs` 中读取 `App.css`，并增加以下断言：

```js
const appCss = read('App.css')

const appMobile = appCss.slice(appCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(appMobile, /\.authenticated-app\s*\{[^}]*overflow-y:\s*auto/s, 'mobile app owns vertical scrolling')
assert.match(appMobile, /\.authenticated-app\s*\{[^}]*overflow-x:\s*hidden/s, 'mobile app prevents page-level horizontal scrolling')
assert.match(appMobile, /padding-bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*var\(--safe-bottom\)\s*\+\s*16px\)/, 'mobile content reserves nav, safe area, and breathing room')
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: FAIL，提示 `mobile app owns vertical scrolling` 或新的 16px 安全间距断言未匹配。

- [ ] **Step 3: 实现唯一主滚动容器**

在 `App.css` 的移动端媒体查询中加入：

```css
.authenticated-app {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.authenticated-app > .page-shell,
.authenticated-app > .home-screen,
.authenticated-app > .module-screen {
  height: auto;
  min-height: 100%;
  overflow: visible;
  padding-bottom: calc(var(--mobile-nav-height) + var(--safe-bottom) + 16px);
}
```

在 `index.css` 移动端规则中移除与上述规则重复的底部间距定义；保留根节点固定视口作为应用容器，避免同时让 `body` 与页面壳滚动。

- [ ] **Step 4: 运行响应式测试**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: `responsive contract passed for 11 routed page styles`。

- [ ] **Step 5: 提交全局布局改动**

```bash
git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/index.css frontend-visitor/src/App.css
git commit -m "fix: 统一移动端页面滚动与底部安全区"
```

### Task 2: 修复首页与我的内容型页面

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/pages/HomePage.css`
- Modify: `frontend-visitor/src/pages/ProfilePage.css`

**Interfaces:**
- Consumes: Task 1 的移动端主滚动容器和底部安全间距。
- Produces: 首页自然高度 Hero、单列小屏表单；我的页面完整纵向卡片流。

- [ ] **Step 1: 写入失败的内容页契约测试**

读取两个页面样式并增加：

```js
const homeCss = read('pages/HomePage.css')
const homeMobile = homeCss.slice(homeCss.lastIndexOf('@media (max-width: 768px)'))
assert.doesNotMatch(homeMobile, /\.hp-hero\s*\{[^}]*(?:min-)?height:\s*(?:680|800)px/s, 'home hero must not force tall mobile viewport')
assert.match(homeCss, /@media\s*\(max-width:\s*480px\)[\s\S]*\.hp-trip-planner__fields\s*\{[^}]*grid-template-columns:\s*1fr/s, 'small phones use a single-column planner')

const profileMobile = profileCss.slice(profileCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(profileMobile, /\.profile-grid,[\s\S]*\.profile-stats\s*\{[^}]*grid-template-columns:\s*1fr/s, 'profile cards stack in one column')
assert.match(profileMobile, /\.profile-card__meta\s*\{[^}]*(?:min-width:\s*0|overflow-wrap:\s*anywhere)/s, 'profile identity supports long text')
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: FAIL，首页固定高度或个人资料长文本规则未满足。

- [ ] **Step 3: 让首页随内容自然展开**

在 `HomePage.css` 的移动端规则中将 Hero 改为：

```css
.hp-hero {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 0;
  margin: 0 -16px;
  overflow: visible;
}

.hp-hero__content {
  width: 100%;
  padding: 32px 20px 24px;
}

.hp-guide {
  position: relative;
  right: auto;
  bottom: auto;
  justify-self: end;
  width: min(240px, 72vw);
  height: 220px;
  margin-top: -28px;
}
```

在 480px 规则中删除 `.hp-hero { min-height: 800px; }`，保留规划表单单列和横向卡片滑动。

- [ ] **Step 4: 加固我的页面文本与末尾间距**

在 `ProfilePage.css` 移动端规则中加入：

```css
.profile-grid,
.profile-stats {
  min-width: 0;
}

.profile-card__meta {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.profile-section:last-child,
.profile-stats:last-child {
  margin-bottom: 16px;
}
```

- [ ] **Step 5: 运行响应式测试并提交**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: PASS。

```bash
git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/pages/HomePage.css frontend-visitor/src/pages/ProfilePage.css
git commit -m "fix: 让首页与个人中心在手机端自然展开"
```

### Task 3: 修复 AI 导览与路线页面堆叠

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.css`
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.css`

**Interfaces:**
- Consumes: Task 1 的应用主滚动容器。
- Produces: AI 舞台与聊天上下分区；路线筛选、地图、摘要、时间线严格纵向排列。

- [ ] **Step 1: 写入失败的沉浸页与路线契约测试**

更新断言为：

```js
assert.match(digitalMobile, /\.live2d-page\s*\{[^}]*grid-template-rows:\s*minmax\(220px,\s*42vh\)\s+auto[^}]*overflow:\s*visible/s, 'digital-human mobile stage and chat form a natural stack')
assert.match(digitalMobile, /\.digital-human-chat\s*\{[^}]*position:\s*relative[^}]*height:\s*auto/s, 'digital-human chat remains in document flow')

const routeMobile = routeCss.slice(routeCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(routeMobile, /\.route-detail\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s, 'route detail stacks map and content')
assert.match(routeMobile, /\.route-detail__content\s*\{[^}]*position:\s*relative[^}]*overflow:\s*visible/s, 'route summary and timeline remain in flow')
assert.doesNotMatch(routeMobile, /\.route-node:not\(:last-child\)::after\s*\{[^}]*bottom:\s*-\d+px/s, 'timeline connector must not escape its node')
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: FAIL，AI 分区高度、路线内容定位或负值时间线连接线不满足。

- [ ] **Step 3: 重排 AI 导览移动端区域**

将 `DigitalHumanPage.css` 最后的 768px 规则收敛为：

```css
.live2d-page {
  display: grid;
  grid-template-rows: minmax(220px, 42vh) auto;
  height: auto;
  min-height: 100%;
  overflow: visible;
}

.live2d-canvas {
  position: relative;
  min-height: 220px;
}

.digital-human-status {
  right: 18px;
  bottom: 16px;
  left: 18px;
}

.digital-human-chat {
  position: relative;
  inset: auto;
  width: auto;
  height: auto;
  min-height: 420px;
  margin: 0 10px 16px;
}
```

同时覆盖 720px 规则中依赖 `min(58vh, 560px)` 计算的状态条、舞台光效和人物底部位置，使它们只相对 `.live2d-canvas` 定位。

- [ ] **Step 4: 让路线各区域进入普通文档流**

在 `RouteRecommendPage.css` 移动端规则中加入并替换冲突项：

```css
.route-planner,
.route-detail,
.route-detail__content,
.route-timeline {
  min-width: 0;
}

.route-detail {
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.route-detail__map {
  flex: 0 0 auto;
  min-height: 280px;
}

.route-detail__content {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: visible;
}

.route-node:not(:last-child)::after {
  top: 30px;
  bottom: 0;
}
```

- [ ] **Step 5: 运行测试并提交**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: PASS。

```bash
git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/pages/DigitalHumanPage.css frontend-visitor/src/pages/RouteRecommendPage.css
git commit -m "fix: 消除 AI 导览与路线页的移动端内容重叠"
```

### Task 4: 修复地图浮层并完成全量验证

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/pages/MapPage.css`

**Interfaces:**
- Consumes: Task 1 的主滚动与安全区、现有 `.map-page--spot-selected` 状态类。
- Produces: 地图主区域、文档流侧栏、受控景点详情卡；最终可验证的响应式契约。

- [ ] **Step 1: 写入失败的地图移动端契约测试**

替换固定侧栏预期并增加：

```js
const mapMobile = mapCss.slice(mapCss.lastIndexOf('@media (max-width: 768px)'))
assert.match(mapMobile, /\.map-page\s*\{[^}]*display:\s*grid[^}]*height:\s*auto/s, 'mobile map and services use document flow')
assert.match(mapMobile, /\.map-page__main\s*\{[^}]*height:\s*clamp\(480px,\s*68vh,\s*680px\)/s, 'mobile map has a stable visible height')
assert.match(mapMobile, /\.map-side\s*\{[^}]*position:\s*relative[^}]*inset:\s*auto/s, 'mobile services no longer cover the map')
assert.doesNotMatch(mapMobile, /\.map-side\s*\{[^}]*position:\s*fixed/s, 'mobile services must not be fixed')
assert.match(mapMobile, /\.map-spot-card\s*\{[^}]*bottom:\s*calc\(var\(--mobile-nav-height\)\s*\+\s*var\(--safe-bottom\)\s*\+\s*12px\)/s, 'selected spot card clears mobile navigation')
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: FAIL，提示地图侧栏仍为固定定位。

- [ ] **Step 3: 将直播和附近服务移入内容流**

将 `MapPage.css` 的移动端规则改为：

```css
.map-page {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  height: auto;
  overflow: visible;
}

.map-page__main {
  height: clamp(480px, 68vh, 680px);
  min-height: 480px;
}

.map-side {
  position: relative;
  inset: auto;
  z-index: auto;
  max-height: none;
  overflow: visible;
  border-radius: 18px;
}

.map-page--spot-selected .map-side {
  display: grid;
}

.map-spot-card {
  position: fixed;
  top: auto;
  right: 12px;
  bottom: calc(var(--mobile-nav-height) + var(--safe-bottom) + 12px);
  left: 12px;
  width: auto;
  max-height: min(45vh, 420px);
  overflow-y: auto;
}
```

保持搜索、分类和地图控件位于 `.map-page__main` 内；确认其已有定位不依赖 `.map-side`。

- [ ] **Step 4: 运行游客端完整验证**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: `responsive contract passed for 11 routed page styles`。

Run: `cd frontend-visitor && node src/components/VisitorTopNav.test.mjs && node src/pages/HomePage.test.mjs && node src/pages/mapConfig.test.mjs && node src/pages/FeedbackPage.test.mjs`

Expected: 所有脚本退出码为 0。

Run: `cd frontend-visitor && npm run lint`

Expected: 退出码为 0，无 ESLint 错误。

Run: `cd frontend-visitor && npm run build`

Expected: `tsc -b && vite build` 成功并生成 `dist/`。

- [ ] **Step 5: 执行代码级移动端复核**

Run:

```bash
rg -n "position: fixed|height: 100%|min-height: (680|800)px|bottom: -[0-9]+px|overflow-y: auto" \
  frontend-visitor/src/App.css \
  frontend-visitor/src/pages/HomePage.css \
  frontend-visitor/src/pages/DigitalHumanPage.css \
  frontend-visitor/src/pages/RouteRecommendPage.css \
  frontend-visitor/src/pages/MapPage.css \
  frontend-visitor/src/pages/ProfilePage.css
```

Expected: 固定定位只剩底部导航和选中景点详情卡；首页移动端不存在 680px/800px Hero；路线移动端不存在负值连接线；局部滚动只用于消息、菜单和景点详情。

- [ ] **Step 6: 提交地图和最终验证改动**

```bash
git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/pages/MapPage.css
git commit -m "fix: 让地图服务卡在移动端避开主视图与底栏"
```

## 完成标准

- 五张问题截图对应的结构性重叠均有明确代码修复。
- 移动端只有一个主要纵向滚动容器。
- 固定底栏不遮挡任何页面的最后内容或主要操作。
- 320–768px 不产生页面级横向滚动。
- 响应式契约测试、相关页面测试、ESLint 和生产构建全部通过。
- 工作树只包含本计划范围内的改动。
