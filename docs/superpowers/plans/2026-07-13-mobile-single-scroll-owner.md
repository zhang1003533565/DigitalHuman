# 移动端单一滚动所有者 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 消除游客页面移动端嵌套纵向滚动，让 `.authenticated-app__content` 成为唯一页面级滚动容器，同时保留必要的局部交互滚动。

**Architecture:** 在共享移动媒体查询中解除 `.page-content` 的内部滚动，再分别覆盖首页 `.hp-scroll` 和贴士 `.tips-scroll-area` 的页面级滚动。响应式契约同时维护局部滚动白名单，确保聊天、地图弹窗、直播回答和用户菜单仍可独立浏览。

**Tech Stack:** CSS、Node `assert` 源码契约测试、ESLint、Vite。

## Global Constraints

- 768px 以下只有 `.authenticated-app__content` 可以作为页面级纵向滚动容器。
- 页面根、`.page-content`、`.hp-scroll`、`.tips-scroll-area` 和路线普通内容必须使用自然高度与 `overflow: visible`。
- 页面级移动容器不得使用 `overscroll-behavior: contain` 或 `touch-action: none`。
- `.digital-chat-body`、`.digital-chat-select__menu`、`.map-spot-card`、`.live-interaction__answer`、`.visitor-user-menu__dropdown` 可以保留受限局部纵向滚动。
- 数字人画布可保留 `touch-action: none`，其页面与聊天外层必须允许 `pan-y`。
- 固定底部导航和全局安全区预留保持不变，页面不得重复预留。
- 桌面端现有滚动行为不变。
- 不打开浏览器，基于代码契约、Lint 和生产构建验证。

---

### Task 1: 统一移动页面滚动所有权

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify: `frontend-visitor/src/App.css`
- Modify: `frontend-visitor/src/pages/HomePage.css`
- Modify: `frontend-visitor/src/pages/TravelTipsPage.css`

**Interfaces:**
- Consumes: `.authenticated-app__content` 移动外层滚动、`.page-content` 公共页面主体、`.hp-scroll` 首页主体、`.tips-scroll-area` 贴士主体。
- Produces: 所有普通游客页面共享一个外层纵向滚动；移动局部滚动测试白名单。

- [ ] **Step 1: 写失败的单一滚动所有者契约**

  在 `responsive.test.mjs` 中增加公共主体、首页和贴士样式读取：

  ```js
  const travelTipsCss = read('pages/TravelTipsPage.css')
  ```

  保留现有 `.authenticated-app__content` 断言，并新增：

  ```js
  assert.match(
    appMobile,
    /\.page-content\s*\{[^}]*flex:\s*none;[^}]*min-height:\s*auto;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s,
    'mobile shared page content must flow through the authenticated scroller',
  )

  const homeMobile = homeCss.slice(homeCss.lastIndexOf('@media (max-width: 768px)'))
  assert.match(
    homeMobile,
    /\.hp-scroll\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*100%;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s,
    'mobile home content must not create a nested vertical scroller',
  )

  const tipsMobile = travelTipsCss.slice(travelTipsCss.lastIndexOf('@media (max-width: 768px)'))
  assert.match(
    tipsMobile,
    /\.tips-scroll-area\s*\{[^}]*flex:\s*none;[^}]*min-height:\s*auto;[^}]*overflow:\s*visible;[^}]*overscroll-behavior:\s*auto;/s,
    'mobile tips content must flow through the authenticated scroller',
  )
  ```

  增加禁止回归断言：

  ```js
  for (const [name, css] of [
    ['shared page content', appMobile],
    ['home page', homeMobile],
    ['travel tips', tipsMobile],
    ['route page', routeMobile],
  ]) {
    assert.doesNotMatch(
      css,
      /\.(?:page-content|hp-scroll|tips-scroll-area|route-planner|route-detail__content|route-timeline)\s*\{[^}]*(?:overflow(?:-y)?:\s*(?:auto|scroll)|overscroll-behavior:\s*contain|touch-action:\s*none)/s,
      `${name} must not own mobile page scrolling`,
    )
  }
  ```

- [ ] **Step 2: 运行测试确认按预期失败**

  Run: `cd frontend-visitor && node src/responsive.test.mjs`

  Expected: FAIL；`.page-content`、`.hp-scroll` 和 `.tips-scroll-area` 尚未提供移动自然流覆盖，首页与贴士仍保留内部滚动。

- [ ] **Step 3: 在共享移动规则解除 page-content 滚动**

  在 `App.css` 的 `@media (max-width: 768px)` 中增加：

  ```css
  .page-content {
    flex: none;
    min-height: auto;
    overflow: visible;
    overscroll-behavior: auto;
  }
  ```

  不修改桌面 `.page-content` 的 `flex: 1 1 auto` 和 `overflow-y: auto`。

- [ ] **Step 4: 让首页和贴士移动主体进入自然流**

  在 `HomePage.css` 的移动媒体查询中补充：

  ```css
  .hp-scroll {
    height: auto;
    min-height: 100%;
    overflow: visible;
    overscroll-behavior: auto;
    padding: 0 16px 24px;
  }
  ```

  在 `TravelTipsPage.css` 的最后一个移动媒体查询中补充：

  ```css
  .tips-scroll-area {
    flex: none;
    min-height: auto;
    overflow: visible;
    overscroll-behavior: auto;
  }
  ```

  分类栏 `.tips-category-bar` 继续保留 `overflow-x: auto`，不得改为纵向滚动。

- [ ] **Step 5: 运行目标测试确认通过**

  Run: `cd frontend-visitor && node src/responsive.test.mjs`

  Expected: 输出 `responsive contract passed for 12 routed page styles`。

- [ ] **Step 6: 提交统一滚动修复**

  ```bash
  git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/App.css frontend-visitor/src/pages/HomePage.css frontend-visitor/src/pages/TravelTipsPage.css
  git commit -m "fix: 恢复移动游客页面的统一纵向滑动"
  ```

---

### Task 2: 锁定局部滚动白名单并完成回归验证

**Files:**
- Modify: `frontend-visitor/src/responsive.test.mjs`
- Modify only if a failing whitelist test proves necessary: `frontend-visitor/src/pages/DigitalHumanPage.css`
- Modify only if a failing whitelist test proves necessary: `frontend-visitor/src/pages/MapPage.css`
- Modify only if a failing whitelist test proves necessary: `frontend-visitor/src/pages/LiveBroadcastPage.css`
- Modify only if a failing whitelist test proves necessary: `frontend-visitor/src/components/VisitorTopNav.css`

**Interfaces:**
- Consumes: Task 1 的单一页面级滚动规则。
- Produces: `BOUNDED_LOCAL_SCROLL_ALLOWLIST` 与数字人聊天 flex 约束，明确可保留的五个局部滚动选择器及其边界契约。

- [ ] **Step 1: 写局部滚动白名单契约**

  在 `responsive.test.mjs` 中增加：

  ```js
  const BOUNDED_LOCAL_SCROLL_ALLOWLIST = [
    ['digital character menu', digitalHumanCss, '.digital-chat-select__menu'],
    ['map spot card', mapMobile, '.map-spot-card'],
    ['live answer history', liveBroadcastCss, '.live-interaction__answer'],
    ['visitor user menu', topNavCss, '.visitor-user-menu__dropdown'],
  ]

  for (const [name, css, selector] of BOUNDED_LOCAL_SCROLL_ALLOWLIST) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.match(
      css,
      new RegExp(`${escaped}\\s*\\{[^}]*(?:max-height|height):[^;}]+;[^}]*overflow-y:\\s*auto`, 's'),
      `${name} must remain bounded and vertically scrollable`,
    )
  }

  assert.match(
    digitalHumanCss,
    /\.digital-chat-body\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;[^}]*overflow-y:\s*auto;/s,
    'digital chat history stays bounded by its flex panel and locally scrollable',
  )
  ```

  对数字人触摸边界增加或保留：

  ```js
  assert.match(digitalMobile, /\.live2d-page\s*\{[^}]*touch-action:\s*pan-y/s)
  assert.match(digitalMobile, /\.digital-human-chat\s*\{[^}]*touch-action:\s*pan-y/s)
  assert.match(digitalMobile, /\.live2d-canvas\s*\{[^}]*touch-action:\s*none/s)
  ```

- [ ] **Step 2: 运行白名单契约并处理真实失败**

  Run: `cd frontend-visitor && node src/responsive.test.mjs`

  Expected: PASS；若某白名单区域缺少确定 `height|max-height` 或 `overflow-y:auto`，测试应 FAIL，并只在对应组件样式中补齐受限局部滚动，不扩大白名单。

- [ ] **Step 3: 执行游客端完整验证**

  Run:

  ```bash
  cd frontend-visitor
  for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done
  npm run lint
  npm run build
  git diff --check
  ```

  Expected: 全部 Node 测试、ESLint、TypeScript、Vite 构建和 diff 检查通过。

- [ ] **Step 4: 提交白名单契约与必要修复**

  ```bash
  git add frontend-visitor/src/responsive.test.mjs frontend-visitor/src/pages/DigitalHumanPage.css frontend-visitor/src/pages/MapPage.css frontend-visitor/src/pages/LiveBroadcastPage.css frontend-visitor/src/components/VisitorTopNav.css
  git commit -m "test: 锁定移动局部滚动白名单"
  ```

## 完成标准

- 首页、公共 page-content、贴士和路线普通内容不再拥有移动端纵向滚动。
- `.authenticated-app__content` 继续拥有唯一页面级 `overflow-y: auto`。
- 五个白名单局部区域保持限高与独立滚动。
- 数字人页面可纵向滑动，画布仍可独占交互。
- 底部导航安全区只由共享内容容器预留。
- 游客端全部测试、Lint 和生产构建通过。
