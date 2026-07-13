# Mobile Map Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将游客端地图移动布局改造成地图优先的单屏工作台，并以可访问底部抽屉承载数字人直播和附近服务。

**Architecture:** 保留 `MapPage` 的地图实例、搜索、分类、定位和路由逻辑，新增一个纯函数模块描述移动抽屉状态与清除结果可见性。`MapPage.tsx` 同时渲染桌面侧栏和移动工作台控件，通过 CSS 断点分流；移动抽屉使用原有直播与服务数据，不增加接口、路由或依赖。

**Tech Stack:** React 19、TypeScript 6、React Router 7、CSS、Node.js `node:test`/`assert` 契约测试、Vite 8。

## Global Constraints

- 仅调整 `max-width: 768px` 的地图体验，桌面端双栏布局保持不变。
- 不更换高德地图 SDK，不新增后端接口、持久化状态、页面路由或第三方依赖。
- 搜索、定位、缩放、景区中心、清除结果、直播跳转和语音互动必须复用现有处理函数或路由。
- 主要验收视口为 375×667、390×844、430×932，并覆盖安全区和短横屏。
- 地图控件不得遮挡底部导航，不得产生横向滚动、竖排操作文字或被压成细条的直播卡。
- 按用户要求不打开浏览器；真实移动浏览器手势、软键盘和地图 SDK 视觉点验作为非阻断缺口记录。
- 直接提交当前 `main`，不创建分支或 worktree。

---

## File Structure

- Create: `frontend-visitor/src/map/mobileMapWorkbench.ts` — 移动地图抽屉状态、在线文案和搜索结果可见性的纯函数契约。
- Create: `frontend-visitor/src/map/mobileMapWorkbench.test.mjs` — 编译并执行移动工作台纯函数测试。
- Create: `frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs` — 页面结构、可访问性和移动 CSS 的静态契约测试。
- Modify: `frontend-visitor/src/pages/MapPage.tsx` — 新增移动工具栏、分类面板、服务抽屉、焦点和 Escape 行为。
- Modify: `frontend-visitor/src/pages/MapPage.css` — 桌面内容保持原样；新增移动单屏地图工作台、抽屉和短屏规则。
- Modify: `frontend-visitor/src/responsive.test.mjs` — 更新旧移动内容流断言并验证代表性视口堆叠。

---

### Task 1: 移动地图状态契约

**Files:**
- Create: `frontend-visitor/src/map/mobileMapWorkbench.ts`
- Create: `frontend-visitor/src/map/mobileMapWorkbench.test.mjs`

**Interfaces:**
- Consumes: `liveStatus: 'loading' | 'live' | 'ready' | 'error'`、搜索关键词和搜索标记数量。
- Produces: `MobileMapDrawerState`、`toggleMobileMapDrawer(state)`、`getMobileMapLiveLabel(status)`、`shouldShowMobileMapClearAction(keyword, resultCount)`。

- [ ] **Step 1: 写入失败的纯函数测试**

```js
const source = join(root, 'mobileMapWorkbench.ts')
const outDir = join(tmpdir(), `mobile-map-workbench-${process.pid}`)
execFileSync('npx', ['tsc', source, '--ignoreConfig', '--outDir', outDir, '--target', 'es2023', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--skipLibCheck'])
const workbench = await import(pathToFileURL(join(outDir, 'mobileMapWorkbench.js')))

assert.equal(workbench.toggleMobileMapDrawer('collapsed'), 'expanded')
assert.equal(workbench.toggleMobileMapDrawer('expanded'), 'collapsed')
assert.equal(workbench.getMobileMapLiveLabel('live'), '在线')
assert.equal(workbench.getMobileMapLiveLabel('error'), '同步失败')
assert.equal(workbench.shouldShowMobileMapClearAction('', 0), false)
assert.equal(workbench.shouldShowMobileMapClearAction('灵山', 0), true)
assert.equal(workbench.shouldShowMobileMapClearAction('', 2), true)
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cd frontend-visitor && node src/map/mobileMapWorkbench.test.mjs`

Expected: FAIL，提示 `mobileMapWorkbench.ts` 不存在。

- [ ] **Step 3: 实现最小状态模块**

```ts
export type MobileMapDrawerState = 'collapsed' | 'expanded'
export type MobileMapLiveStatus = 'loading' | 'live' | 'ready' | 'error'

export function toggleMobileMapDrawer(state: MobileMapDrawerState): MobileMapDrawerState {
  return state === 'expanded' ? 'collapsed' : 'expanded'
}

export function getMobileMapLiveLabel(status: MobileMapLiveStatus) {
  if (status === 'live') return '在线'
  if (status === 'error') return '同步失败'
  return '准备中'
}

export function shouldShowMobileMapClearAction(keyword: string, resultCount: number) {
  return keyword.trim().length > 0 || resultCount > 0
}
```

测试使用 `try/finally` 调用 `rmSync(outDir, { recursive: true, force: true })`，不得在仓库内残留编译产物。

- [ ] **Step 4: 运行测试并确认 GREEN**

Run: `cd frontend-visitor && node src/map/mobileMapWorkbench.test.mjs`

Expected: PASS，输出 `mobile map workbench state contract passed`。

- [ ] **Step 5: 提交任务**

```bash
git add frontend-visitor/src/map/mobileMapWorkbench.ts frontend-visitor/src/map/mobileMapWorkbench.test.mjs
git commit -m "feat: 建立移动地图工作台状态契约" \
  -m "Constraint: 不新增后端接口或第三方依赖" \
  -m "Rejected: 将抽屉状态混入地图 SDK 实例 | 难以独立测试" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: 移动工作台派生文案应继续通过纯函数维护" \
  -m "Tested: mobileMapWorkbench.test.mjs" \
  -m "Not-tested: 页面 DOM 尚未实现" \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

### Task 2: 移动工具栏与可访问服务抽屉

**Files:**
- Create: `frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs`
- Modify: `frontend-visitor/src/pages/MapPage.tsx`

**Interfaces:**
- Consumes: Task 1 的 `MobileMapDrawerState`、`toggleMobileMapDrawer`、`getMobileMapLiveLabel`、`shouldShowMobileMapClearAction`。
- Produces: `.page-shell--map`、`.page-content--map`、`.map-mobile-toolbar`、`.map-mobile-context-actions`、`.map-mobile-drawer`、`.map-mobile-category-panel` DOM 契约；`clearSearchResults()` 统一清理逻辑。

- [ ] **Step 1: 写入失败的页面结构契约测试**

```js
assert.match(page, /const \[mobileDrawerState, setMobileDrawerState\] = useState<MobileMapDrawerState>\('collapsed'\)/)
assert.match(page, /const \[mobileCategoryOpen, setMobileCategoryOpen\] = useState\(false\)/)
assert.match(page, /<main className="page-shell page-shell--map">/)
assert.match(page, /<section className="page-content page-content--map">/)
assert.match(page, /className="map-mobile-toolbar"/)
assert.match(page, /className="map-mobile-context-actions"/)
assert.match(page, /className={`map-mobile-drawer map-mobile-drawer--\$\{mobileDrawerState\}`}/)
assert.match(page, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-labelledby="mobile-map-drawer-title"/)
assert.match(page, /event\.key === 'Escape'/)
assert.match(page, /mobileDrawerTriggerRef\.current\?\.focus\(\)/)
assert.match(page, /function clearSearchResults\(\)/)
assert.match(page, /navigate\('\/live'\)/)
assert.match(page, /navigate\(DIGITAL_HUMAN_ROUTE\)/)
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `cd frontend-visitor && node src/pages/MapPage.mobile-workbench.test.mjs`

Expected: FAIL，缺少移动工作台状态和 DOM。

- [ ] **Step 3: 统一清除搜索逻辑并记录结果状态**

在 `MapPage` 增加：

```ts
const [searchResultCount, setSearchResultCount] = useState(0)

function clearSearchResults() {
  const map = mapInstanceRef.current
  if (map && searchMarkersRef.current.length) map.remove?.(searchMarkersRef.current)
  searchMarkersRef.current = []
  setSearchResultCount(0)
  setKeyword('')
}
```

搜索回调在创建标记后调用 `setSearchResultCount(searchMarkersRef.current.length)`；所有清除入口统一调用 `clearSearchResults()`。

- [ ] **Step 4: 增加移动状态、焦点和 Escape 生命周期**

```ts
const [mobileDrawerState, setMobileDrawerState] = useState<MobileMapDrawerState>('collapsed')
const [mobileCategoryOpen, setMobileCategoryOpen] = useState(false)
const mobileDrawerRef = useRef<HTMLElement | null>(null)
const mobileDrawerTriggerRef = useRef<HTMLButtonElement | null>(null)

const closeMobileDrawer = useCallback(() => {
  setMobileDrawerState('collapsed')
  window.requestAnimationFrame(() => mobileDrawerTriggerRef.current?.focus())
}, [])

useEffect(() => {
  if (mobileDrawerState !== 'expanded') return
  const panel = mobileDrawerRef.current
  const focusable = Array.from(panel?.querySelectorAll<HTMLElement>(
    'a[href]:not([tabindex="-1"]), button:not(:disabled):not([tabindex="-1"]), input:not(:disabled):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
  ) ?? [])
  focusable[0]?.focus()

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeMobileDrawer()
      return
    }
    if (event.key !== 'Tab' || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable.at(-1) ?? first
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  document.addEventListener('keydown', handleKeyDown)
  return () => document.removeEventListener('keydown', handleKeyDown)
}, [closeMobileDrawer, mobileDrawerState])

useEffect(() => {
  if (!mobileCategoryOpen) return
  const closeCategories = (event: KeyboardEvent) => {
    if (event.key === 'Escape') setMobileCategoryOpen(false)
  }
  document.addEventListener('keydown', closeCategories)
  return () => document.removeEventListener('keydown', closeCategories)
}, [mobileCategoryOpen])
```

同时从 React 导入 `useCallback`。分类面板 Escape 关闭但不影响抽屉状态。

- [ ] **Step 5: 渲染移动工具栏和分类面板**

```tsx
<div className="map-mobile-toolbar">
  <button
    type="button"
    className="map-mobile-category-trigger"
    aria-expanded={mobileCategoryOpen}
    aria-controls="mobile-map-categories"
    onClick={() => setMobileCategoryOpen((open) => !open)}
  >
    分类
  </button>
  <div className="map-mobile-search-slot">
    <input
      value={keyword}
      onChange={(event) => setKeyword(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          handleSearch()
        }
      }}
      placeholder="搜索地点、景点或服务"
    />
    <button type="button" aria-label="搜索" onClick={handleSearch}>搜</button>
  </div>
</div>
<div id="mobile-map-categories" className="map-mobile-category-panel" hidden={!mobileCategoryOpen}>
  {sidebarCategories.map((category) => {
    const currentKey = category.categoryId ? String(category.categoryId) : category.key
    return (
      <button
        key={category.key}
        type="button"
        aria-pressed={activeCategory === currentKey}
        onClick={() => handleCategorySelect(category)}
      >
        <span aria-hidden>{category.icon}</span>
        <span>{category.label}</span>
      </button>
    )
  })}
</div>
```

把桌面分类按钮现有内联逻辑抽成 `handleCategorySelect(category: SidebarCategory)`，桌面和移动按钮都调用它。桌面 `.map-sidebar` 和 `.map-search` 保留；移动结构继续使用相同的 `keyword`、`handleSearch`、`activeCategory` 和 `categoryPage`。

- [ ] **Step 6: 渲染上下文操作和服务抽屉**

```tsx
<div className="map-mobile-context-actions">
  <button type="button" onClick={() => mapInstanceRef.current?.setCenter?.(LINGSHAN_CENTER)}>景区中心</button>
  {showClearSearch ? <button type="button" onClick={clearSearchResults}>清除结果</button> : null}
</div>

<section className={`map-mobile-drawer map-mobile-drawer--${mobileDrawerState}`} aria-label="地图服务">
  <button ref={mobileDrawerTriggerRef} type="button" aria-expanded={mobileDrawerState === 'expanded'}>AI 数字人 · {liveLabel}　附近服务</button>
  {mobileDrawerState === 'expanded' ? (
    <div className="map-mobile-drawer__overlay" onMouseDown={closeMobileDrawer}>
      <article
        ref={mobileDrawerRef}
        className="map-mobile-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-map-drawer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="map-mobile-drawer__header">
          <div>
            <span>景区服务</span>
            <h2 id="mobile-map-drawer-title">边走边看，服务随行</h2>
          </div>
          <button type="button" aria-label="关闭景区服务" onClick={closeMobileDrawer}>×</button>
        </header>
        {renderLiveCard()}
        {renderNearbyCard()}
      </article>
    </div>
  ) : null}
</section>
```

将现有直播卡和附近服务卡的完整 JSX 分别移动进组件内的 `renderLiveCard()` 与 `renderNearbyCard()`，桌面 `.map-side` 和移动抽屉都调用这两个函数。`renderLiveCard()` 保留三条现有讲解文案，并保留 `navigate('/live')`、`navigate(DIGITAL_HUMAN_ROUTE)`；`renderNearbyCard()` 保留六项现有服务和“查看更多”。遮罩调用 `closeMobileDrawer`，面板通过 `stopPropagation()` 阻止内部点击关闭。

- [ ] **Step 7: 运行页面与既有地图测试**

Run: `cd frontend-visitor && node src/pages/MapPage.mobile-workbench.test.mjs && node src/pages/mapConfig.test.mjs`

Expected: 两项 PASS。

- [ ] **Step 8: 提交任务**

```bash
git add frontend-visitor/src/pages/MapPage.tsx frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs
git commit -m "feat: 增加移动地图工具栏与服务抽屉" \
  -m "Constraint: 桌面双栏结构和现有地图业务逻辑必须保留" \
  -m "Rejected: 为移动端复制一套地图实例 | 会造成状态与标记漂移" \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: 搜索清理必须继续经过 clearSearchResults" \
  -m "Tested: MapPage mobile workbench 与 map config tests" \
  -m "Not-tested: 尚未应用最终移动 CSS" \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

### Task 3: 单屏地图、抽屉与代表性视口布局

**Files:**
- Modify: `frontend-visitor/src/pages/MapPage.css`
- Modify: `frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs`
- Modify: `frontend-visitor/src/responsive.test.mjs`

**Interfaces:**
- Consumes: Task 2 的移动 DOM 类名和全局 `--mobile-nav-height`、`--safe-bottom`、`--touch-target` token。
- Produces: 单屏地图高度、移动工具分层、服务抽屉停靠和景点卡避让 CSS 契约。

- [ ] **Step 1: 将旧移动内容流断言改为地图工作台断言并确认 RED**

```js
assert.match(mapMobile, /\.page-shell--map\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s)
assert.match(mapMobile, /\.page-content--map\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0[^}]*overflow:\s*hidden/s)
assert.match(mapMobile, /\.map-page\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/s)
assert.match(mapMobile, /\.map-page__main\s*\{[^}]*height:\s*100%[^}]*min-height:\s*0/s)
assert.match(mapMobile, /\.map-side\s*\{[^}]*display:\s*none/s)
assert.match(mapMobile, /\.map-actions\s*\{[^}]*display:\s*none/s)
assert.match(mapMobile, /\.map-mobile-drawer\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*calc\(var\(--mobile-nav-height\)[^}]*var\(--safe-bottom\)/s)
assert.match(mapMobile, /\.map-mobile-drawer__panel\s*\{[^}]*max-height:\s*min\(72dvh,\s*620px\)[^}]*overflow-y:\s*auto/s)
assert.match(mapMobile, /\.map-spot-card\s*\{[^}]*bottom:\s*calc\(var\(--mobile-nav-height\)[^}]*var\(--map-mobile-drawer-peek-height\)/s)
```

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: FAIL，旧 CSS 仍使用内容流和五项操作栏。

- [ ] **Step 2: 建立移动单屏变量与地图画布**

在 `@media (max-width: 768px)` 中使用：

```css
.map-page {
  --map-mobile-drawer-peek-height: 64px;
  --map-mobile-edge: 12px;
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.page-shell--map {
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.page-content--map {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding-top: 0;
}

.map-page__main {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
}
```

`authenticated-app` 已由 flex 布局扣除 56px 移动顶部导航，`.authenticated-app__content` 已为固定底部导航预留 `64px + safe-bottom + 16px`。地图专用 shell 只消费父级剩余的 `100%`，不得再次从 `100dvh` 重复扣减顶部或底部导航。

- [ ] **Step 3: 分流桌面与移动控件**

```css
.map-mobile-toolbar,
.map-mobile-context-actions,
.map-mobile-drawer { display: none; }

@media (max-width: 768px) {
  .map-sidebar,
  .map-search,
  .map-actions,
  .map-side { display: none; }

  .map-mobile-toolbar,
  .map-mobile-context-actions,
  .map-mobile-drawer { display: flex; }

  .map-controls { right: var(--map-mobile-edge); bottom: calc(var(--map-mobile-drawer-peek-height) + 24px); }
  .map-ctrl-btn { width: var(--touch-target); min-height: var(--touch-target); border-radius: 50%; }
}
```

移动搜索栏保持单行，输入框设置 `min-width: 0`；所有按钮设置 `white-space: nowrap`，禁止出现竖排文字。

- [ ] **Step 4: 实现服务抽屉和景点卡堆叠**

```css
.map-mobile-drawer {
  position: fixed;
  right: 12px;
  bottom: calc(var(--mobile-nav-height) + var(--safe-bottom) + 8px);
  left: 12px;
  z-index: 30;
}

.map-mobile-drawer--expanded { z-index: 50; }

.map-mobile-drawer__panel {
  max-height: min(72dvh, 620px);
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
}

.map-spot-card {
  z-index: 40;
  bottom: calc(var(--mobile-nav-height) + var(--safe-bottom) + var(--map-mobile-drawer-peek-height) + 20px);
}
```

抽屉遮罩占据导航以上可视区域；收起摘要不创建内部滚动。景点卡位于收起摘要之上，展开模态抽屉再提升到景点卡之上。展开面板复用 `.live-card__*` 和 `.nearby__*` 视觉，但不得依赖桌面 `.map-side` 尺寸。

- [ ] **Step 5: 增加短屏、横屏和 reduced-motion 规则**

```css
@media (max-width: 768px) and (max-height: 700px) {
  .map-mobile-drawer__panel { max-height: 68dvh; }
  .live-card__msg:nth-child(-n + 2) { display: none; }
}

@media (max-width: 900px) and (max-height: 520px) and (orientation: landscape) {
  .map-mobile-drawer__panel { max-height: 74dvh; }
}

@media (prefers-reduced-motion: reduce) {
  .map-mobile-drawer__panel,
  .map-mobile-drawer__overlay { transition: none; animation: none; }
}
```

- [ ] **Step 6: 增加代表性视口静态计算**

在 `responsive.test.mjs` 对 375×667、390×844、430×932 计算：

```js
for (const [width, height] of [[375, 667], [390, 844], [430, 932]]) {
  assert.ok(width >= 320)
  const available = height - 56 - 64 - 34 - 16 - 24
  assert.ok(available > 420, `${width}x${height} keeps a usable map viewport`)
  assert.ok(64 + 34 + 8 >= 106, 'drawer peek clears navigation and safe area')
}
```

测试同时断言移动长操作栏隐藏、搜索输入 `min-width: 0`、操作文字 `white-space: nowrap`、抽屉与景点卡的 bottom 公式共享 `--map-mobile-drawer-peek-height`。

- [ ] **Step 7: 运行移动页面和响应式测试**

Run: `cd frontend-visitor && node src/pages/MapPage.mobile-workbench.test.mjs && node src/responsive.test.mjs`

Expected: 两项 PASS。

- [ ] **Step 8: 提交任务**

```bash
git add frontend-visitor/src/pages/MapPage.css frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs frontend-visitor/src/responsive.test.mjs
git commit -m "style: 重构移动地图为单屏工作台" \
  -m "Constraint: 必须覆盖三种代表性视口和底部安全区" \
  -m "Rejected: 将直播与服务继续放入页面内容流 | 短屏会压缩地图" \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: 移动地图新增控件必须进入现有工具层或服务抽屉" \
  -m "Tested: map mobile workbench 与 responsive tests" \
  -m "Not-tested: 未打开真实移动浏览器" \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

### Task 4: 全量回归与发布门禁

**Files:**
- Modify only if a failure proves necessary: `frontend-visitor/src/pages/MapPage.tsx`
- Modify only if a failure proves necessary: `frontend-visitor/src/pages/MapPage.css`
- Modify only if a failure proves necessary: `frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs`
- Modify only if a failure proves necessary: `frontend-visitor/src/responsive.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–3 的完整移动地图工作台。
- Produces: 全量测试、Lint、生产构建、差异检查和独立代码审查证据。

- [ ] **Step 1: 运行全部 Node 测试**

Run:

```bash
cd frontend-visitor
for test_file in $(find src -name '*.test.mjs' -type f | sort); do node "$test_file"; done
```

Expected: 所有测试文件退出码为 0。

- [ ] **Step 2: 运行静态检查和生产构建**

Run:

```bash
cd frontend-visitor
npm run lint
npm run build
```

Expected: ESLint 退出码 0；TypeScript 与 Vite production build 退出码 0。

- [ ] **Step 3: 检查差异与工作区**

Run:

```bash
git diff --check
git status --short
```

Expected: `git diff --check` 无输出；任务提交后工作区干净。

- [ ] **Step 4: 执行独立代码审查并修复阻断项**

审查范围从本计划基线提交到当前 HEAD，至少检查：

- 桌面 `.map-page`、`.map-side` 和原有直播/服务内容未回归；
- 移动抽屉 Escape、焦点进入、焦点循环和触发器恢复；
- 分类面板和抽屉不会同时制造不可关闭的遮罩；
- 搜索结果数量与 `clearSearchResults()` 在成功、空结果、重复搜索时一致；
- 375×667、390×844、430×932 和安全区公式无控件重叠；
- 未新增依赖、接口、路由或地图实例。

Critical 或 Important 必须修复并重新审查；Minor 记录为非阻断风险。

- [ ] **Step 5: 如有门禁修复则提交**

```bash
git add frontend-visitor/src/map frontend-visitor/src/pages/MapPage.tsx frontend-visitor/src/pages/MapPage.css frontend-visitor/src/pages/MapPage.mobile-workbench.test.mjs frontend-visitor/src/responsive.test.mjs
git commit -m "fix: 收紧移动地图工作台交互边界" \
  -m "Constraint: 修复不得改变桌面地图业务行为" \
  -m "Rejected: 以跳过测试交付 | 无法证明移动布局边界" \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: 后续地图移动改动必须保持单屏工具层与抽屉分层" \
  -m "Tested: 全部 Node tests、ESLint、TypeScript、Vite build、diff check" \
  -m "Not-tested: 按用户要求未打开真实浏览器" \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

若无门禁修复，不创建空提交。
