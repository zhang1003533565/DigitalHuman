# 移动直播文案与数字人可见性修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让游客端移动直播页完整显示弹幕文案，并让绑定的 Live2D 数字人在不同舞台尺寸下稳定可见。

**Architecture:** 保持现有直播数据流、画布和互动结构不变。消息显示仅移除移动端的两行裁切；数字人布局新增纯函数，根据舞台尺寸、模型原始尺寸和现有模型微调参数计算缩放与坐标，加载完成时应用该结果。

**Tech Stack:** React 19、TypeScript、PixiJS/Live2D、CSS、Node.js 契约测试。

## Global Constraints

- 不修改后端接口、直播配置协议或管理端配置。
- 不新增依赖。
- 桌面端直播结构和普通数字人导览页行为保持不变。
- 先观察回归测试失败，再写最小生产代码使其通过。

---

### Task 1: 移动弹幕完整显示

**Files:**
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.css`

**Interfaces:**
- Consumes: `.live-chat__message p` 的现有移动端响应式规则。
- Produces: 移动端消息正文自然换行、无 `-webkit-line-clamp` 的样式合同。

- [x] **Step 1: 写失败测试**

在 `LiveBroadcastPage.test.mjs` 断言 CSS 不包含 `-webkit-line-clamp`，并断言移动端消息正文使用 `white-space: normal` 与 `overflow-wrap: anywhere`。

- [x] **Step 2: 运行测试确认失败**

Run: `node src/pages/LiveBroadcastPage.test.mjs`

Expected: FAIL，指出仍存在 `-webkit-line-clamp: 2` 或缺少自然换行规则。

- [x] **Step 3: 写最小实现**

将移动端 `.live-chat__message p` 改为：

```css
.live-chat__message p { white-space: normal; overflow-wrap: anywhere; }
```

- [x] **Step 4: 运行测试确认通过**

Run: `node src/pages/LiveBroadcastPage.test.mjs`

Expected: 输出 `live broadcast page contract passed`。

### Task 2: Live2D 舞台自适应布局

**Files:**
- Create: `frontend-visitor/src/live/live2dStageLayout.ts`
- Create: `frontend-visitor/src/live/live2dStageLayout.test.mjs`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.tsx`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

**Interfaces:**
- Consumes: 舞台宽高、模型原始宽高、`scaleMultiplier`、`xOffsetRatio`、`yOffsetRatio`。
- Produces: `resolveLive2dStageLayout(input): { scale: number; x: number; y: number }`。

- [x] **Step 1: 写失败测试**

为 `resolveLive2dStageLayout` 覆盖 390×640 移动舞台、1200×700 桌面舞台和无效尺寸防御，断言缩放随舞台改变、中心坐标有效且结果为有限正数；同时扩展页面契约，禁止固定 `scale.set(0.24`。

- [x] **Step 2: 运行测试确认失败**

Run: `node src/live/live2dStageLayout.test.mjs && node src/pages/LiveBroadcastPage.test.mjs`

Expected: FAIL，因为纯函数尚不存在且页面仍使用固定缩放。

- [x] **Step 3: 写最小实现**

实现纯函数，以 `Math.min(stageWidth / modelWidth, stageHeight / modelHeight) * scaleMultiplier` 计算适配比例；坐标以舞台中心和现有偏移比例计算。直播页模型加载后读取 `canvas.clientWidth/clientHeight`，调用纯函数并一次性设置 `scale/x/y`。

- [x] **Step 4: 运行目标测试确认通过**

Run: `node src/live/live2dStageLayout.test.mjs && node src/pages/LiveBroadcastPage.test.mjs`

Expected: 两个测试均通过。

### Task 3: 完整验证

**Files:**
- Verify only: `frontend-visitor`

**Interfaces:**
- Consumes: 前两项修复。
- Produces: 可交付的游客端构建与静态检查证据。

- [x] **Step 1: 运行游客端全部 Node 测试**

Run: `for test_file in $(rg --files src -g '*.test.mjs'); do node "$test_file"; done`

Expected: 所有测试退出码为 0。

- [x] **Step 2: 运行 ESLint**

Run: `npm run lint`

Expected: 退出码为 0。

- [x] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 与 Vite 构建退出码为 0。

## 验证结果

- 目标直播页测试与 Live2D 布局测试通过。
- ESLint 与生产构建通过。
- 游客端 29 个 Node 契约测试中 27 个通过；`MapPage.mobile-workbench.test.mjs` 和 `mapConfig.test.mjs` 因现有地图实现与旧断言不一致失败，均未触及本次修改文件。
