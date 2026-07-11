# 景区数字人全系统升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付一个同时适合比赛演示、真实游客使用和后台持续运营，并完整适配移动端的景区数字人系统。

**Architecture:** 保留 React 游客端、React 管理端、Spring Boot 业务后端与 FastAPI AI 服务的四端边界。Java 后端作为业务真值、权限、持久化与降级中心，AI 服务负责 Agent、RAG 和 TTS；两个前端只消费结构化接口并共享一致的状态与响应式规范。

**Tech Stack:** React 19、TypeScript 6、Vite 8、Ant Design 6、ECharts 6、Spring Boot、Spring Data JPA、FastAPI、Pydantic、Live2D、Qdrant、高德地图。

## Global Constraints

- 不替换 React、Spring Boot、FastAPI、Live2D、Qdrant 或现有地图供应商。
- 不新增第二套前端组件库或新的大型框架。
- 游客端最低主要适配宽度为 `360px`。
- 响应式验收覆盖 `360px`、`390px`、`768px`、`1024px`、`1440px`。
- AI 服务不可用时，Java 后端仍须返回基础路线与景区数据。
- 模型 API Key 不返回明文；地图与模型密钥不得硬编码在提交的前端源码中。
- 修改大型页面时只拆分本任务涉及的职责，不做无关全仓重构。
- 每个任务先写失败测试，再做最小实现，再运行目标验证并提交 Lore 协议提交信息。

---

## 文件结构与职责

### 新建文件

- `frontend-visitor/src/api/contracts.ts`：游客端共享接口类型。
- `frontend-visitor/src/api/client.ts`：统一请求、错误归一化与追踪标识读取。
- `frontend-visitor/src/components/AsyncState.tsx`：加载、空数据、错误与重试状态。
- `frontend-visitor/src/components/MobileBottomNav.tsx`：手机端主导航。
- `frontend-visitor/src/components/TripPlanner.tsx`：首页快捷规划表单。
- `frontend-visitor/src/components/GuideResultCards.tsx`：数字人结构化景点、路线、追问与来源卡片。
- `frontend-visitor/src/styles/tokens.css`：断点、安全区域和触控尺寸变量。
- `frontend-visitor/src/api/contracts.test.mjs`：结构化回答与路线查询序列化测试。
- `frontend-admin/src/api/operations.ts`：运营总览、反馈状态和健康检查接口。
- `frontend-admin/src/pages/OperationsDashboardPage.tsx`：真实运营总览。
- `frontend-admin/src/pages/FeedbackManagementPage.tsx`：反馈处理闭环。
- `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TripPlanRequest.java`：路线规划条件。
- `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TripPlanResponse.java`：结构化路线规划结果。
- `backend-java/src/main/java/com/digitalhuman/backend_java/dto/OperationsOverviewDto.java`：运营总览聚合结果。
- `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminOperationsController.java`：运营指标与服务健康接口。
- `backend-java/src/main/java/com/digitalhuman/backend_java/service/OperationsService.java`：指标聚合。
- `backend-java/src/main/java/com/digitalhuman/backend_java/config/TraceIdFilter.java`：请求追踪标识。
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicRouteServiceTests.java`：多条件路线筛选与降级测试。
- `backend-java/src/test/java/com/digitalhuman/backend_java/service/OperationsServiceTests.java`：指标聚合测试。
- `ai-service/tests/test_agent_contract.py`：AI 结构化结果与失败契约测试。

### 重点修改文件

- `frontend-visitor/src/App.tsx`、`components/AppTopNav.tsx`：桌面/手机导航与路由上下文。
- `frontend-visitor/src/pages/HomePage.tsx`：动态首页与规划入口。
- `frontend-visitor/src/pages/DigitalHumanPage.tsx`：结构化回答与运行状态。
- `frontend-visitor/src/pages/RouteRecommendPage.tsx`、`MapPage.tsx`：上下文联动与移动布局。
- `frontend-visitor/src/pages/HistoryPage.tsx`、`FeedbackPage.tsx`：恢复会话与关联反馈。
- 对应游客端 CSS：响应式布局、安全区域和触控状态。
- `frontend-admin/src/pages/AdminLayout.tsx`、`components/AdminSidebar.tsx`、`App.css`：新页面接入与窄屏抽屉。
- `frontend-admin/src/pages/settings/ChatConfigPage.tsx`、`MultimodalConfigPage.tsx`、`VisionConfigPage.tsx`：移除 mock 操作。
- `backend-java/.../ScenicRouteService.java`、`UserScenicController.java`：统一规划接口。
- `backend-java/.../GuideChatResponse.java`、`GuideService.java`、`UserGuideController.java`：结构化问答。
- `backend-java/.../UserFeedback.java`、`FeedbackRequest.java`、`FeedbackRecordDto.java`、`AdminGuideController.java`：反馈状态闭环。
- `backend-java/.../AdminSettingsController.java`、`AdminSettingsService.java`：模型真实保存与测试能力复用。
- `ai-service/agents/common/types.py`、`agents/leader_agent/agent.py`、`schemas.py`、`app.py`：结构化 AI 输出和降级。
- `frontend-visitor/.env.example`、`README.md`：地图环境变量与部署说明。

---

### Task 1: 建立全仓验证基线与游客端共享契约

**Files:**
- Create: `frontend-visitor/src/api/contracts.ts`
- Create: `frontend-visitor/src/api/client.ts`
- Create: `frontend-visitor/src/api/contracts.test.mjs`
- Modify: `frontend-visitor/package.json`

**Interfaces:**
- Produces: `TripPlanRequest`、`TripPlanResponse`、`GuideChatResult`、`ApiProblem`、`buildTripPlanSearchParams(request)`、`getApiProblem(error)`。

- [ ] **Step 1: 记录基线结果**

Run:

```bash
cd frontend-visitor && npm run build && npm run lint
cd ../frontend-admin && npm run build && npm run lint
cd ../backend-java && ./mvnw test
cd ../ai-service && python -m compileall .
```

Expected: 保存每条命令的通过结果；若失败，记录原始失败但不在本任务扩展修复无关问题。

- [ ] **Step 2: 写失败的契约测试**

```js
import assert from 'node:assert/strict'
import { buildTripPlanSearchParams, normalizeGuideChatResult } from './contracts.js'

assert.equal(buildTripPlanSearchParams({ interest: '亲子家庭', durationHours: 4, intensity: '轻松少走', groupType: 'family' }).toString(), 'interest=%E4%BA%B2%E5%AD%90%E5%AE%B6%E5%BA%AD&durationHours=4&intensity=%E8%BD%BB%E6%9D%BE%E5%B0%91%E8%B5%B0&groupType=family')
assert.deepEqual(normalizeGuideChatResult({ answerText: '你好', relatedSpots: ['灵山大佛'], recommendedRoutes: ['route-1'] }).suggestions, [])
```

- [ ] **Step 3: 运行测试并确认失败**

Run: `cd frontend-visitor && node src/api/contracts.test.mjs`

Expected: FAIL，提示模块或导出不存在。

- [ ] **Step 4: 实现共享契约与错误类型**

```ts
export type TripPlanRequest = { interest: string; durationHours?: number; intensity?: string; groupType?: string }
export type GuideChatResult = { sessionId: string; traceId: string; answerText: string; relatedSpots: string[]; recommendedRoutes: string[]; suggestions: string[]; sources: Array<{ title: string; content: string }> }
export function buildTripPlanSearchParams(input: TripPlanRequest) {
  const params = new URLSearchParams()
  Object.entries(input).forEach(([key, value]) => value !== undefined && value !== '' && params.set(key, String(value)))
  return params
}
export function normalizeGuideChatResult(input: Partial<GuideChatResult>): GuideChatResult {
  return { sessionId: input.sessionId ?? '', traceId: input.traceId ?? '', answerText: input.answerText ?? '', relatedSpots: input.relatedSpots ?? [], recommendedRoutes: input.recommendedRoutes ?? [], suggestions: input.suggestions ?? [], sources: input.sources ?? [] }
}
```

- [ ] **Step 5: 验证并提交**

Run: `cd frontend-visitor && node src/api/contracts.test.mjs && npm run build`

Expected: 契约测试通过，Vite 构建成功。

Commit intent: `统一游客端数据契约以支撑跨页面闭环`。

---

### Task 2: 后端多条件行程规划与规则降级

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TripPlanRequest.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TripPlanResponse.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicRouteServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicRouteService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserScenicController.java`

**Interfaces:**
- Consumes: 已有 `ScenicRouteDto` 与启用路线仓储。
- Produces: `POST /api/user/scenic/trip-plan` 与 `ScenicRouteService.planTrip(TripPlanRequest)`。

- [ ] **Step 1: 写多条件筛选失败测试**

```java
@Test
void planTripFiltersByInterestDurationAndIntensity() {
    TripPlanRequest request = new TripPlanRequest("亲子家庭", 4, "轻松少走", "family");
    TripPlanResponse result = service.planTrip(request);
    assertEquals("route-3", result.route().getId());
    assertFalse(result.reminders().isEmpty());
}
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `cd backend-java && ./mvnw -Dtest=ScenicRouteServiceTests test`

Expected: FAIL，`TripPlanRequest` 或 `planTrip` 不存在。

- [ ] **Step 3: 实现 DTO、评分与降级**

评分固定为：兴趣匹配 `+40`、时长不超过预算 `+25`、强度匹配 `+20`、同行人标签匹配 `+15`；无完全匹配时返回得分最高的启用官方路线。响应包含 `route`、`score`、`reasons`、`reminders`、`fallbackUsed`。

```java
public TripPlanResponse planTrip(TripPlanRequest request) {
    List<ScenicRoute> routes = routeRepository.findByEnabledTrueOrderBySortOrderAsc();
    if (routes.isEmpty()) {
        return TripPlanResponse.empty("暂无可用路线，请先在管理后台启用路线");
    }
    return routes.stream().map(route -> score(route, request)).max(Comparator.comparingInt(ScoredRoute::score)).map(this::toResponse).orElseThrow();
}
```

- [ ] **Step 4: 暴露规划接口并保留旧接口兼容**

```java
@PostMapping("/trip-plan")
public TripPlanResponse planTrip(@Valid @RequestBody TripPlanRequest request) {
    return scenicRouteService.planTrip(request);
}
```

- [ ] **Step 5: 验证并提交**

Run: `cd backend-java && ./mvnw -Dtest=ScenicRouteServiceTests test`

Expected: 多条件、无完全匹配和无路线三类测试通过。

Commit intent: `让行程推荐基于完整游客条件并保持可降级`。

---

### Task 3: 首页动态内容与快捷行程规划

**Files:**
- Create: `frontend-visitor/src/components/TripPlanner.tsx`
- Create: `frontend-visitor/src/components/AsyncState.tsx`
- Modify: `frontend-visitor/src/pages/HomePage.tsx`
- Modify: `frontend-visitor/src/pages/HomePage.css`
- Modify: `frontend-visitor/src/pages/HomePage.test.mjs`

**Interfaces:**
- Consumes: `TripPlanRequest`、`TripPlanResponse`、`POST /api/user/scenic/trip-plan`、`GET /api/home`。
- Produces: 跳转 `/routes?plan=<encoded route id>` 并在 `sessionStorage['digitalhuman.tripPlan']` 保存结果。

- [ ] **Step 1: 扩展失败测试**

```js
assert.match(source, /TripPlanner/)
assert.doesNotMatch(source, /const inspirationItems = \[/)
assert.match(source, /digitalhuman\.tripPlan/)
```

- [ ] **Step 2: 运行测试确认硬编码仍存在**

Run: `cd frontend-visitor && node src/pages/HomePage.test.mjs`

Expected: FAIL，仍检测到静态推荐数组或缺少规划器。

- [ ] **Step 3: 实现规划器和动态回退**

`TripPlanner` 使用受控字段 `interest`、`durationHours`、`intensity`、`groupType`，提交期间禁用按钮；成功后保存结果并导航，失败时显示带“重新规划”按钮的错误状态。首页接口为空时显示说明性空状态，不恢复伪造运营数据。

- [ ] **Step 4: 完成响应式首页**

在 `<= 768px` 时 Hero 改为单列、规划器字段改为两列；在 `<= 480px` 时改为单列、按钮宽度 `100%`、卡片横向滚动并使用 `scroll-snap-type`。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend-visitor && node src/pages/HomePage.test.mjs && npm run build && npm run lint`

Expected: 测试、构建、Lint 通过。

Commit intent: `让首页成为动态行程规划入口`。

---

### Task 4: 数字人结构化回答、快捷追问与状态机

**Files:**
- Create: `frontend-visitor/src/components/GuideResultCards.tsx`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/GuideChatResponse.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/GuideService.java`
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.tsx`
- Modify: `frontend-visitor/src/pages/DigitalHumanPage.css`
- Test: `frontend-visitor/src/api/contracts.test.mjs`

**Interfaces:**
- Produces: `GuideChatResponse.suggestions`；前端 `GuideRuntimeState = 'loading' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'`。

- [ ] **Step 1: 写失败测试**

```js
assert.deepEqual(normalizeGuideChatResult({ answerText: '欢迎', suggestions: ['附近有什么？'] }).suggestions, ['附近有什么？'])
```

并在 Java 测试中断言回答至少含三条非空 `suggestions`。

- [ ] **Step 2: 运行契约与 Java 目标测试确认失败**

Run: `cd frontend-visitor && node src/api/contracts.test.mjs`

Run: `cd backend-java && ./mvnw -Dtest=GuideServiceTests test`

Expected: Java 侧因新字段或测试类缺失而失败。

- [ ] **Step 3: 扩展后端响应**

根据回答与关联景点生成最多三条快捷追问，例如“查看灵山大佛位置”“推荐适合我的路线”“还有哪些注意事项”；保持既有 `answerText`、`relatedSpots`、`recommendedRoutes`、`sources` 字段兼容。

- [ ] **Step 4: 将页面布尔状态收敛为运行状态**

发送问题设置 `thinking`，首段语音播放切换 `speaking`，播放完成恢复 `idle`，异常进入 `error`。`GuideResultCards` 的路线按钮跳转路线页，景点按钮跳转地图页，追问按钮直接填充并发送问题。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend-visitor && node src/api/contracts.test.mjs && npm run build`

Run: `cd backend-java && ./mvnw -Dtest=GuideServiceTests test`

Expected: 两端契约一致，目标测试通过。

Commit intent: `让数字人回答可继续操作而不止展示文本`。

---

### Task 5: 路线、地图、历史与反馈上下文闭环

**Files:**
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.tsx`
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.css`
- Modify: `frontend-visitor/src/pages/MapPage.tsx`
- Modify: `frontend-visitor/src/pages/MapPage.css`
- Modify: `frontend-visitor/src/pages/HistoryPage.tsx`
- Modify: `frontend-visitor/src/pages/FeedbackPage.tsx`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/FeedbackRequest.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/model/UserFeedback.java`

**Interfaces:**
- Consumes: `digitalhuman.tripPlan`、查询参数 `routeId`、`spotId`、`sessionId`、`traceId`。
- Produces: 反馈关联字段 `routeId`、`messageId` 与可恢复会话入口。

- [ ] **Step 1: 写后端反馈关联失败测试**

```java
assertEquals("route-3", saved.getRouteId());
assertEquals(42L, saved.getMessageId());
assertEquals("PENDING", saved.getStatus());
```

- [ ] **Step 2: 运行测试确认字段不存在**

Run: `cd backend-java && ./mvnw -Dtest=GuideServiceTests#saveFeedbackKeepsContext test`

Expected: FAIL，关联字段不存在。

- [ ] **Step 3: 实现关联持久化与页面传参**

`UserFeedback` 新增 `routeId`、`messageId`、`status='PENDING'`、`category`、`adminNote`。路线页优先读取已保存规划，地图页根据 `routeId` 绘制路线并根据 `spotId` 打开详情，历史页点击会话跳转数字人页并携带 `sessionId`。

- [ ] **Step 4: 为跨页面状态增加容错**

查询参数无效或本地规划过期时重新从接口加载；反馈缺少上下文时仍允许提交普通意见，但明确标记 `GENERAL` 类别。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend-visitor && npm run build && npm run lint`

Run: `cd backend-java && ./mvnw -Dtest=GuideServiceTests test`

Expected: 构建、Lint 与反馈服务测试通过。

Commit intent: `串联路线地图会话与反馈上下文`。

---

### Task 6: 游客端手机优先响应式框架

**Files:**
- Create: `frontend-visitor/src/styles/tokens.css`
- Create: `frontend-visitor/src/components/MobileBottomNav.tsx`
- Modify: `frontend-visitor/src/main.tsx`
- Modify: `frontend-visitor/src/App.tsx`
- Modify: `frontend-visitor/src/components/AppTopNav.tsx`
- Modify: `frontend-visitor/src/components/AppTopNav.css`
- Modify: `frontend-visitor/src/index.css`
- Modify: all `frontend-visitor/src/pages/*.css` files used by routed pages.

**Interfaces:**
- Produces: CSS 变量 `--touch-target: 44px`、`--safe-bottom`、`--mobile-nav-height`；手机端五入口导航。

- [ ] **Step 1: 写静态响应式失败测试**

```js
assert.match(tokens, /--touch-target:\s*44px/)
assert.match(tokens, /env\(safe-area-inset-bottom/)
assert.match(app, /MobileBottomNav/)
```

- [ ] **Step 2: 运行测试确认缺少移动框架**

Run: `cd frontend-visitor && node src/responsive.test.mjs`

Expected: FAIL，tokens 或底部导航不存在。

- [ ] **Step 3: 实现统一断点与移动导航**

桌面顶部导航在 `<= 768px` 隐藏非品牌区，底部导航显示首页、AI 导览、路线、地图、我的；页面根容器增加 `padding-bottom: calc(var(--mobile-nav-height) + var(--safe-bottom))`。

- [ ] **Step 4: 逐页消除移动端阻塞**

数字人页改上下布局；地图详情改底部卡片；路线改纵向时间轴；登录、反馈、历史、个人页表单单列；所有关键按钮最小高度 `44px`，不依赖 hover。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend-visitor && node src/responsive.test.mjs && npm run build && npm run lint`

Expected: 静态契约、构建和 Lint 通过；浏览器手工检查五个目标宽度，无非预期横向滚动。

Commit intent: `保证游客核心流程可在手机上单手完成`。

---

### Task 7: 运营指标聚合后端

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/OperationsOverviewDto.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/OperationsService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminOperationsController.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/OperationsServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/GuideMessageRepository.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/GuideSessionRepository.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/UserFeedbackRepository.java`

**Interfaces:**
- Produces: `GET /api/admin/operations/overview`，字段为 `visitorCount`、`sessionCount`、`messageCount`、`successRate`、`knowledgeHitRate`、`averageRating`、`popularQuestions`、`popularRoutes`、`serviceHealth`。

- [ ] **Step 1: 写聚合失败测试**

```java
@Test
void overviewUsesPersistedSessionsMessagesAndFeedback() {
    OperationsOverviewDto overview = service.getOverview();
    assertEquals(3, overview.sessionCount());
    assertEquals(4.5, overview.averageRating());
    assertEquals("亲子路线", overview.popularRoutes().getFirst().label());
}
```

- [ ] **Step 2: 运行测试确认服务不存在**

Run: `cd backend-java && ./mvnw -Dtest=OperationsServiceTests test`

Expected: FAIL，`OperationsService` 不存在。

- [ ] **Step 3: 实现仓储聚合与零数据语义**

指标只使用持久化数据；分母为零时比率返回 `0`，不生成演示随机数。服务健康复用 `AdminSettingsService.getAiHealth()`，单个健康检查失败时标记该项 `degraded`，总览其余指标仍返回。

- [ ] **Step 4: 暴露管理员接口**

```java
@GetMapping("/overview")
public OperationsOverviewDto overview() {
    return operationsService.getOverview();
}
```

- [ ] **Step 5: 验证并提交**

Run: `cd backend-java && ./mvnw -Dtest=OperationsServiceTests test`

Expected: 正常、零数据和健康检查降级测试通过。

Commit intent: `用真实业务数据支撑运营总览`。

---

### Task 8: 管理端运营总览、反馈闭环与窄屏布局

**Files:**
- Create: `frontend-admin/src/api/operations.ts`
- Create: `frontend-admin/src/pages/OperationsDashboardPage.tsx`
- Create: `frontend-admin/src/pages/FeedbackManagementPage.tsx`
- Modify: `frontend-admin/src/pages/AdminLayout.tsx`
- Modify: `frontend-admin/src/components/AdminSidebar.tsx`
- Modify: `frontend-admin/src/App.css`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminGuideController.java`

**Interfaces:**
- Consumes: `GET /api/admin/operations/overview`、`GET /api/admin/guide/feedback`、`PATCH /api/admin/guide/feedback/{id}`。

- [ ] **Step 1: 写页面静态失败测试**

```js
assert.match(layout, /OperationsDashboardPage/)
assert.match(layout, /FeedbackManagementPage/)
assert.match(css, /@media\s*\(max-width:\s*768px\)/)
```

- [ ] **Step 2: 运行测试确认仍使用旧面板**

Run: `cd frontend-admin && node src/pages/admin-upgrade.test.mjs`

Expected: FAIL，新页面未接入。

- [ ] **Step 3: 实现真实运营总览**

顶部指标卡展示真实数据；中部使用 ECharts 展示问题与路线排行；底部显示服务健康。每个区域独立处理加载和失败，健康接口失败不能清空业务指标。

- [ ] **Step 4: 实现反馈处理与窄屏抽屉**

反馈支持状态、分类、管理员备注与筛选。`<= 1024px` 侧边栏缩窄，`<= 768px` 使用 Drawer；表格保留关键列并以 Drawer 展示详情，表单改单列。

- [ ] **Step 5: 验证并提交**

Run: `cd frontend-admin && node src/pages/admin-upgrade.test.mjs && npm run build && npm run lint`

Expected: 页面测试、构建和 Lint 通过。

Commit intent: `让后台从录入工具升级为可运营控制台`。

---

### Task 9: 移除模型配置 mock 并复用真实后端能力

**Files:**
- Modify: `frontend-admin/src/pages/settings/ChatConfigPage.tsx`
- Modify: `frontend-admin/src/pages/settings/MultimodalConfigPage.tsx`
- Modify: `frontend-admin/src/pages/settings/VisionConfigPage.tsx`
- Modify: `frontend-admin/src/pages/settings/EmbeddingConfigPage.tsx`
- Modify: `frontend-admin/src/pages/settings/VoiceConfigPage.tsx`
- Modify: `frontend-admin/src/pages/AdminLayout.tsx`
- Modify: `frontend-admin/src/api/aiModelConfig.ts`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/AdminSettingsService.java`

**Interfaces:**
- Consumes: 现有 `/api/admin/settings`、模型测试、Catalog 与 Provider 配置接口。
- Produces: 所有设置页的 `onSave`、`onTest`、`onOpenManual` 只调用真实父级处理器。

- [ ] **Step 1: 写 mock 扫描失败测试**

Run:

```bash
rg -n "mock|仅作页面展示|暂未接入后端" frontend-admin/src/pages/settings
```

Expected: 找到现有 mock 保存、测试或菜单操作。

- [ ] **Step 2: 为后端设置保存与测试补充控制器测试**

测试 API Key 返回掩码、空掩码不会覆盖已有密钥、真实测试失败返回可理解结果且不泄漏密钥。

- [ ] **Step 3: 删除页面内部伪操作**

设置页变成受控展示组件；保存和测试全部调用 `AdminLayout` 已有真实处理器。无法支持的展示菜单直接删除，不保留成功提示伪装已完成。

- [ ] **Step 4: 验证无 mock 且真实接口测试通过**

Run: `rg -n "mock|仅作页面展示|暂未接入后端" frontend-admin/src/pages/settings`

Expected: 无匹配。

Run: `cd frontend-admin && npm run build && npm run lint`

Run: `cd backend-java && ./mvnw -Dtest=AdminSettingsControllerTests test`

Expected: 全部通过。

- [ ] **Step 5: 提交**

Commit intent: `确保后台模型配置操作真实生效且不泄漏密钥`。

---

### Task 10: AI 结构化契约、超时与降级

**Files:**
- Create: `ai-service/tests/test_agent_contract.py`
- Modify: `ai-service/agents/common/types.py`
- Modify: `ai-service/agents/leader_agent/agent.py`
- Modify: `ai-service/schemas.py`
- Modify: `ai-service/app.py`

**Interfaces:**
- Produces: AI 响应 `answer`、`spots`、`routes`、`suggestions`、`sources`、`degraded`、`provider`、`model`。

- [ ] **Step 1: 写失败测试**

```python
def test_leader_result_is_structured():
    result = normalize_agent_result({"answer": "欢迎来到灵山"})
    assert result["spots"] == []
    assert result["routes"] == []
    assert result["suggestions"] == []
    assert result["degraded"] is False
```

以及 provider 超时时断言 `degraded=True` 且 `answer` 非空。

- [ ] **Step 2: 运行测试确认契约不存在**

Run: `cd ai-service && python -m unittest tests.test_agent_contract -v`

Expected: FAIL，归一化函数或字段不存在。

- [ ] **Step 3: 实现归一化与有限超时**

所有 Agent 结果进入统一归一化器；模型异常返回基础景区提示与空结构数组，禁止把异常堆栈写进 `answer`。Provider 调用沿用绑定配置的 `timeoutSeconds`，不做无限重试。

- [ ] **Step 4: 验证并提交**

Run: `cd ai-service && python -m unittest tests.test_agent_contract -v && python -m compileall .`

Expected: 契约、降级测试通过，源码编译通过。

Commit intent: `固定 AI 结构化输出并提供可预测降级`。

---

### Task 11: 追踪标识、统一错误与地图密钥治理

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/config/TraceIdFilter.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/config/WebConfig.java`
- Modify: `frontend-visitor/src/api/client.ts`
- Modify: `frontend-visitor/src/pages/MapPage.tsx`
- Modify: `frontend-visitor/src/pages/RouteRecommendPage.tsx`
- Create: `frontend-visitor/.env.example`
- Modify: `frontend-visitor/vite.config.ts`
- Modify: `README.md`

**Interfaces:**
- Produces: 请求头与响应头 `X-Trace-Id`；环境变量 `VITE_AMAP_KEY`、`VITE_AMAP_SECURITY_KEY`。

- [ ] **Step 1: 写密钥与追踪失败检查**

Run:

```bash
rg -n "5b01b946c26d0f94f7d2ddb9d09ff26f|692196a068ef6c9cad53a55fc9e47ad7" frontend-visitor/src
```

Expected: 当前地图页面找到明文密钥。

- [ ] **Step 2: 写 Filter 测试**

无请求头时响应生成 UUID；已有 `X-Trace-Id` 时校验长度并原样回传；非法值生成新标识。

- [ ] **Step 3: 实现环境配置与统一错误**

```ts
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY
const AMAP_SECURITY_KEY = import.meta.env.VITE_AMAP_SECURITY_KEY
if (!AMAP_KEY) throw new Error('地图服务未配置，请联系管理员')
```

请求客户端读取响应 `X-Trace-Id`，将 HTTP 状态映射为 `ApiProblem`；页面只显示用户可恢复信息。

- [ ] **Step 4: 验证密钥不再出现并提交**

Run: `rg -n "5b01b946c26d0f94f7d2ddb9d09ff26f|692196a068ef6c9cad53a55fc9e47ad7" frontend-visitor/src`

Expected: 无匹配。

Run: `cd frontend-visitor && npm run build && cd ../backend-java && ./mvnw test`

Expected: 构建与测试通过。

Commit intent: `消除前端明文密钥并贯通请求追踪`。

---

### Task 12: 全系统验证、移动端检查与文档收口

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-11-full-system-upgrade-design.md` only if implementation intentionally differs.
- Create: `docs/verification/2026-07-11-full-system-upgrade.md`

**Interfaces:**
- Consumes: Task 1–11 的全部交付。
- Produces: 可复现验证记录与已知限制清单。

- [ ] **Step 1: 执行所有自动验证**

```bash
cd frontend-visitor && node src/api/contracts.test.mjs && node src/pages/HomePage.test.mjs && node src/responsive.test.mjs && npm run lint && npm run build
cd ../frontend-admin && node src/pages/admin-upgrade.test.mjs && npm run lint && npm run build
cd ../backend-java && ./mvnw test
cd ../ai-service && python -m unittest discover -s tests -v && python -m compileall .
```

Expected: 所有命令退出码为 `0`。

- [ ] **Step 2: 检查敏感信息与伪操作**

```bash
rg -n "sk-[A-Za-z0-9_-]{12,}|5b01b946c26d0f94f7d2ddb9d09ff26f|692196a068ef6c9cad53a55fc9e47ad7|已保存设置（mock）|仅作页面展示（mock）" . --glob '!docs/**' --glob '!**/node_modules/**' --glob '!**/target/**'
```

Expected: 无匹配。

- [ ] **Step 3: 验证五个响应式宽度**

在 `360`、`390`、`768`、`1024`、`1440px` 依次检查登录、首页、数字人、路线、地图、历史、反馈、管理总览、反馈管理与模型配置。记录每个宽度是否存在横向滚动、遮挡、文本重叠、不可关闭弹层或小于 `44px` 的核心触控目标。

- [ ] **Step 4: 验证三条端到端流程**

1. 首页填写亲子、4 小时、轻松少走 → 返回亲子路线 → 地图正确绘制 → 数字人继续讲解。
2. 数字人询问“灵山大佛怎么走” → 显示景点、路线、来源和追问 → 提交反馈 → 后台更新状态。
3. 停止 AI 服务 → 规划仍返回官方路线 → 问答显示降级提示 → 后台健康状态显示 degraded。

- [ ] **Step 5: 写验证记录并提交**

验证文档列出命令、结果、响应式宽度、端到端流程、环境依赖与剩余风险，不写未执行的成功结论。

Commit intent: `用全链路证据确认系统升级可交付`。

---

## 完成判定

- Task 1–12 全部勾选。
- 两个前端构建和 Lint 通过，Java 测试通过，Python 契约测试与编译通过。
- 三条端到端流程完成，AI 停止后的降级流程可用。
- 五个目标宽度完成检查且无关键阻塞。
- 设置页不存在已知 mock 成功操作，前端源码不存在已知明文地图密钥。
- 验证记录包含所有未解决风险；如存在关键失败，计划保持未完成状态并继续修复。
