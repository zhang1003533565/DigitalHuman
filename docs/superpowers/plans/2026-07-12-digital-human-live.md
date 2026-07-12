# 数字人持续直播 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立由后端统一时间轴持续运行的数字人直播，并提供游客独立直播页与管理端文案维护/发布能力。

**Architecture:** 后端以不可变发布快照和服务器时间提供统一循环时间轴，不为游客创建播放会话；游客端校准服务器时钟并在本地驱动 Live2D 与语音，个人问答结束后重新同步全局进度；管理端维护草稿并通过事务发布新版本。

**Tech Stack:** Java 17、Spring Boot 3.3、Spring Data JPA、H2/MySQL、React 19、TypeScript 6、Vite 8、Ant Design 5、Axios、Node.js contract tests。

## Global Constraints

- 直播持续存在，游客进入、退出、刷新和个人问答不得启动、停止或重置全局直播。
- 所有游客以服务器时间和同一已发布版本计算相同直播进度。
- 管理端草稿编辑不改变当前直播；只有“立即发布”创建不可变快照并建立新时间轴。
- 游客问答只影响当前游客，回答后必须重新同步版本和服务器时间，不得沿用提问前本地索引。
- 不实现视频推流、录制、回放、CDN、礼物、点赞、在线人数或公开弹幕。
- 不新增第三方依赖；复用现有 Live2D、TTS、问答、统一导航和认证机制。
- 桌面端与 320–768px 移动端均可用；页面和互动区允许 `pan-y`，只有 Live2D 画布限制手势。
- 用户此前要求不打开浏览器；验证使用自动测试、静态契约、Lint 和生产构建。

---

### Task 1: 建立直播草稿、发布快照和时间轴计算核心

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/LiveScriptItem.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/LiveBroadcastVersion.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/LiveBroadcastVersionItem.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/LiveScriptItemRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/LiveBroadcastVersionRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/LiveBroadcastVersionItemRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/LiveTimelineResolver.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/LiveTimelineResolverTests.java`

**Interfaces:**
- Produces: `LiveTimelineResolver.resolve(Instant publishedAt, Instant serverTime, List<TimelineItem> items): Position`。
- Produces: `TimelineItem(Long itemId, long durationMs)` 与 `Position(Long itemId, int itemIndex, long itemOffsetMs, long cycleOffsetMs, long totalDurationMs)`。

- [ ] **Step 1: 写时间轴失败测试**

测试必须覆盖首条、条目边界、循环边界、多轮循环和 `serverTime < publishedAt`：

```java
@Test
void resolvesCurrentItemAcrossLoopBoundaries() {
    Instant start = Instant.parse("2026-07-12T00:00:00Z");
    List<LiveTimelineResolver.TimelineItem> items = List.of(
            new LiveTimelineResolver.TimelineItem(10L, 10_000),
            new LiveTimelineResolver.TimelineItem(20L, 20_000));
    assertThat(resolver.resolve(start, start.plusMillis(15_000), items).itemId()).isEqualTo(20L);
    assertThat(resolver.resolve(start, start.plusMillis(30_000), items).itemId()).isEqualTo(10L);
    assertThat(resolver.resolve(start, start.minusSeconds(2), items).cycleOffsetMs()).isZero();
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && ./mvnw -Dtest=LiveTimelineResolverTests test`

Expected: FAIL，`LiveTimelineResolver` 尚不存在。

- [ ] **Step 3: 创建持久化模型**

`LiveScriptItem` 字段固定为 `id`、`title`、`content`、`durationMs`、`sortOrder`、`enabled`、`createdAt`、`updatedAt`；正文使用 `@Lob`。`LiveBroadcastVersion` 保存 `id`、`publishedAt`、`totalDurationMs`、`itemCount`。`LiveBroadcastVersionItem` 保存 `id`、`versionId`、`sourceItemId`、`title`、`content`、`durationMs`、`sortOrder`，不得与草稿实体建立级联更新关系。

- [ ] **Step 4: 实现纯时间轴解析器**

```java
public Position resolve(Instant publishedAt, Instant serverTime, List<TimelineItem> items) {
    long total = items.stream().mapToLong(TimelineItem::durationMs).sum();
    if (items.isEmpty() || total <= 0) throw new IllegalArgumentException("直播文案不能为空");
    long elapsed = Math.max(0, Duration.between(publishedAt, serverTime).toMillis());
    long cycle = elapsed % total;
    long cursor = 0;
    for (int index = 0; index < items.size(); index++) {
        TimelineItem item = items.get(index);
        if (cycle < cursor + item.durationMs()) {
            return new Position(item.itemId(), index, cycle - cursor, cycle, total);
        }
        cursor += item.durationMs();
    }
    throw new IllegalStateException("直播时间轴无法定位");
}
```

- [ ] **Step 5: 运行测试并提交**

Run: `cd backend-java && ./mvnw -Dtest=LiveTimelineResolverTests test`

Expected: PASS。

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/model backend-java/src/main/java/com/digitalhuman/backend_java/repository backend-java/src/main/java/com/digitalhuman/backend_java/service/LiveTimelineResolver.java backend-java/src/test/java/com/digitalhuman/backend_java/service/LiveTimelineResolverTests.java
git commit -m "feat: 建立持续直播的发布快照与时间轴核心"
```

### Task 2: 实现管理发布服务和游客直播状态接口

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/LiveScriptItemRequest.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/LiveScriptItemDto.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/LivePublishSummaryDto.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VisitorLiveStatusDto.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/LiveBroadcastService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminLiveBroadcastController.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserLiveBroadcastController.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/LiveBroadcastServiceTests.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/controller/LiveBroadcastControllerTests.java`

**Interfaces:**
- Produces admin endpoints under `/api/admin/live-broadcast` for drafts, reorder, publish and summary.
- Produces visitor endpoint `GET /api/user/live/status` returning `status`, `serverTime`, `versionId`, `publishedAt`, `totalDurationMs`, `currentItemId`, `currentItemIndex`, `currentItemOffsetMs`, `cycleOffsetMs`, `items`。

- [ ] **Step 1: 写服务失败测试**

覆盖发布空列表返回 400、启用文案按 `sortOrder,id` 冻结、总时长求和、发布后修改草稿不改变快照、游客状态使用注入的 `Clock`。

- [ ] **Step 2: 写控制器失败测试**

使用 MockMvc 验证：管理员接口需要 ADMIN；游客状态需要登录；未发布返回 `{"status":"notPublished"}`；已发布返回服务器时间和完整快照，不返回草稿 `enabled/updatedAt` 字段。

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend-java && ./mvnw -Dtest=LiveBroadcastServiceTests,LiveBroadcastControllerTests test`

Expected: FAIL，服务与控制器尚不存在。

- [ ] **Step 4: 实现事务发布和状态读取**

`publish()` 必须使用 `@Transactional`，读取启用草稿，按 `sortOrder,id` 排序，逐条校验标题/正文非空且 `durationMs` 在 `1000..600000`，创建新版本与快照；状态读取只选择最新版本并使用 `Clock.instant()` 调用 `LiveTimelineResolver`。

- [ ] **Step 5: 实现 REST 接口**

管理接口固定为：

```text
GET    /api/admin/live-broadcast/items
POST   /api/admin/live-broadcast/items
PUT    /api/admin/live-broadcast/items/{id}
DELETE /api/admin/live-broadcast/items/{id}
PUT    /api/admin/live-broadcast/items/reorder
POST   /api/admin/live-broadcast/publish
GET    /api/admin/live-broadcast/published
GET    /api/user/live/status
```

- [ ] **Step 6: 运行测试并提交**

Run: `cd backend-java && ./mvnw -Dtest=LiveTimelineResolverTests,LiveBroadcastServiceTests,LiveBroadcastControllerTests test`

Expected: PASS。

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/dto backend-java/src/main/java/com/digitalhuman/backend_java/service/LiveBroadcastService.java backend-java/src/main/java/com/digitalhuman/backend_java/controller backend-java/src/test/java/com/digitalhuman/backend_java
git commit -m "feat: 提供直播文案发布与统一游客状态接口"
```

### Task 3: 增加管理端直播文案管理页面

**Files:**
- Create: `frontend-admin/src/api/liveBroadcast.ts`
- Create: `frontend-admin/src/pages/LiveBroadcastManagementPage.tsx`
- Modify: `frontend-admin/src/pages/AdminLayout.tsx`
- Modify: `frontend-admin/src/components/AdminSidebar.tsx`
- Modify: `frontend-admin/src/pages/admin-upgrade.test.mjs`

**Interfaces:**
- Consumes Task 2 admin endpoints.
- Produces menu key `live-broadcast` and route `/admin/live-broadcast`。

- [ ] **Step 1: 写失败的管理端契约测试**

在 `admin-upgrade.test.mjs` 断言侧边栏包含“数字人直播”，`AdminLayout` 映射 `/admin/live-broadcast` 并渲染 `LiveBroadcastManagementPage`，API 文件包含 items/reorder/publish/published 四类调用。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend-admin && node src/pages/admin-upgrade.test.mjs`

Expected: FAIL，缺少直播管理入口。

- [ ] **Step 3: 实现类型化 API**

导出 `LiveScriptItem`、`LiveScriptItemPayload`、`LivePublishSummary` 及 `listLiveItems/createLiveItem/updateLiveItem/deleteLiveItem/reorderLiveItems/publishLiveBroadcast/getPublishedLiveSummary`。

- [ ] **Step 4: 实现管理页面**

页面使用现有 Ant Design 模式，包含发布摘要卡、文案表格、编辑 Modal、启用 Switch、上下移动、删除确认和“立即发布”确认。保存只修改草稿；发布成功后同时刷新列表与摘要。表单校验标题/正文必填，时长限制 `1000..600000` 毫秒。

- [ ] **Step 5: 接入导航并验证**

Run: `cd frontend-admin && node src/pages/admin-upgrade.test.mjs && npm run lint && npm run build`

Expected: contract、Lint、build 全部通过。

- [ ] **Step 6: 提交**

```bash
git add frontend-admin/src/api/liveBroadcast.ts frontend-admin/src/pages/LiveBroadcastManagementPage.tsx frontend-admin/src/pages/AdminLayout.tsx frontend-admin/src/components/AdminSidebar.tsx frontend-admin/src/pages/admin-upgrade.test.mjs
git commit -m "feat: 提供数字人直播文案维护与发布页面"
```

### Task 4: 建立游客端直播时间轴客户端与地图入口

**Files:**
- Create: `frontend-visitor/src/live/liveTimeline.ts`
- Create: `frontend-visitor/src/live/liveTimeline.test.mjs`
- Create: `frontend-visitor/src/api/liveBroadcast.ts`
- Modify: `frontend-visitor/src/pages/MapPage.tsx`

**Interfaces:**
- Produces `resolveLivePosition(status, clientNowMs): LivePosition` 和 `getCalibratedNow(clientNowMs, clockOffsetMs)`。
- Produces Map primary CTA navigates to `/live`; secondary CTA navigates to existing AI guide route. Task 5 registers the protected route when the page component exists.

- [ ] **Step 1: 写时间轴与路由失败测试**

纯函数测试覆盖服务器时钟偏差、中途加入、条目边界、循环和版本变化；静态契约断言地图主按钮调用 `navigate('/live')`，次按钮调用现有 `DIGITAL_HUMAN_ROUTE`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend-visitor && node src/live/liveTimeline.test.mjs && node src/pages/mapConfig.test.mjs`

Expected: FAIL，模块与路由不存在。

- [ ] **Step 3: 实现纯时间轴模块和 API**

`clockOffsetMs = Date.parse(serverTime) - receivedAtClientMs`；所有本地 tick 使用 `Date.now() + clockOffsetMs`。若 `status !== 'live'` 或条目为空，解析器返回 `null`，不得启动假直播。

- [ ] **Step 4: 接入地图按钮**

地图两个按钮分别使用 `/live` 与现有 `DIGITAL_HUMAN_ROUTE`。本任务不创建空直播页面，也不提前注册不可用路由。

- [ ] **Step 5: 运行测试并提交**

Run: `cd frontend-visitor && node src/live/liveTimeline.test.mjs && node src/pages/mapConfig.test.mjs && npm run lint && npm run build`

Expected: PASS。

```bash
git add frontend-visitor/src/live frontend-visitor/src/api/liveBroadcast.ts frontend-visitor/src/pages/MapPage.tsx frontend-visitor/src/pages/mapConfig.test.mjs
git commit -m "feat: 接入持续直播时间轴与地图入口"
```

### Task 5: 实现游客数字人直播页与个人问答恢复

**Files:**
- Create: `frontend-visitor/src/pages/LiveBroadcastPage.tsx`
- Create: `frontend-visitor/src/pages/LiveBroadcastPage.css`
- Create: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`
- Modify: `frontend-visitor/src/App.tsx`
- Modify: `frontend-visitor/src/digitalHuman/shared.ts`
- Modify: `frontend-visitor/src/responsive.test.mjs`

**Interfaces:**
- Consumes Task 4 timeline API and existing Live2D/TTS/guide APIs.
- Produces UI states `syncing | broadcasting | asking | answering | resuming | unavailable | error`。
- Produces protected route `/live` under `ProtectedRoute`。

- [ ] **Step 1: 写页面状态机失败契约**

测试要求：`App.tsx` 在 `ProtectedRoute` 下注册 `/live`；页面加载状态接口；可见性恢复时同步；问答前停止直播语音；回答结束后重新请求状态而非恢复旧索引；版本变化停止旧音频；无发布内容显示“直播内容准备中”；CSS 移动端舞台/互动区自然流、`pan-y` 和底栏安全区。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs`

Expected: FAIL，页面不存在或缺少状态机契约。

- [ ] **Step 3: 实现页面与播放协调器**

页面持有 `AbortController`、当前 `HTMLAudioElement`、版本 ref 和同步序号。任何新同步/提问/卸载先取消旧请求和音频。直播 tick 根据校准时间刷新字幕和进度；条目变化才触发新 TTS。回答结束执行 `syncLiveStatus('answer-complete')`，不得设置为提问前的 item index。

- [ ] **Step 4: 复用 Live2D 与互动能力**

复用 `DigitalHumanPage` 已有模型/语音选择与 guide API 契约，抽取到 `digitalHuman/shared.ts` 的仅是无页面状态的常量或小工具；不得复制认证、模型目录或 TTS URL 解析逻辑。页面提供返回地图、当前字幕、下一条预告、文字输入、语音按钮、发送和停止本地回答。

- [ ] **Step 5: 实现响应式样式**

桌面使用舞台 + 侧栏；移动端使用单列文档流。`.live-broadcast-page` 与互动面板为 `touch-action: pan-y`，Live2D canvas 为 `touch-action: none`；底部 padding 使用 `calc(var(--mobile-nav-height) + var(--safe-bottom) + 16px)`。

- [ ] **Step 6: 验证并提交**

Run: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs && node src/live/liveTimeline.test.mjs && node src/responsive.test.mjs && npm run lint && npm run build`

Expected: PASS。

```bash
git add frontend-visitor/src/pages/LiveBroadcastPage.tsx frontend-visitor/src/pages/LiveBroadcastPage.css frontend-visitor/src/pages/LiveBroadcastPage.test.mjs frontend-visitor/src/App.tsx frontend-visitor/src/digitalHuman/shared.ts frontend-visitor/src/responsive.test.mjs
git commit -m "feat: 实现持续直播舞台与游客个人互动恢复"
```

### Task 6: 完整回归、权限和交付验证

**Files:**
- Test: `backend-java/src/test/java/com/digitalhuman/backend_java/controller/LiveBroadcastControllerTests.java`
- Test: `frontend-admin/src/pages/admin-upgrade.test.mjs`
- Test: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`
- Create: `docs/verification/2026-07-12-digital-human-live.md`

**Interfaces:**
- Consumes all prior tasks.
- Produces final verification record with commands, pass counts and disclosed gaps.

- [ ] **Step 1: 运行后端完整相关测试**

Run: `cd backend-java && ./mvnw -Dtest=LiveTimelineResolverTests,LiveBroadcastServiceTests,LiveBroadcastControllerTests,GuideServiceTests,UserGuideControllerTests test`

Expected: 0 failures, 0 errors。

- [ ] **Step 2: 运行管理端全部门禁**

Run: `cd frontend-admin && node src/pages/admin-upgrade.test.mjs && npm run lint && npm run build`

Expected: 全部退出码 0。

- [ ] **Step 3: 运行游客端全部测试、Lint 和构建**

Run: `cd frontend-visitor && for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done && npm run lint && npm run build`

Expected: 所有 Node 测试、ESLint、TypeScript 与 Vite build 通过。

- [ ] **Step 4: 复核安全与持续直播语义**

检查游客状态不泄露草稿；管理员接口拒绝普通用户；游客进入/退出不写直播版本；问答完成路径只调用重新同步；不存在全局暂停接口；发布快照不引用可变草稿实体。

- [ ] **Step 5: 写验证记录并提交**

记录已执行命令、输出摘要、版本切换/边界测试和“按用户要求未打开浏览器”的视觉验证缺口。

```bash
git add backend-java/src/test frontend-admin/src/pages/admin-upgrade.test.mjs frontend-visitor/src/pages/LiveBroadcastPage.test.mjs docs/verification/2026-07-12-digital-human-live.md
git commit -m "test: 锁定数字人持续直播的统一进度与恢复语义"
```

## 完成标准

- 管理员可维护、排序、启停并发布直播文案快照。
- 所有游客以同一服务器时间轴加入当前直播进度。
- 游客退出不停止直播，个人提问不影响其他游客。
- 回答结束重新同步全局当前进度。
- 地图主按钮进入受保护独立直播页。
- 桌面与移动代码契约满足布局、手势和底栏安全区要求。
- 后端相关测试、两个前端的测试/Lint/build 全部通过。
- 最终工作树只包含本计划范围内改动。
