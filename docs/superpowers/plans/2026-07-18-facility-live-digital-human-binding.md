# 景点直播数字人绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让后台按景点选择直播数字人，并让游客直播页严格加载该绑定模型。

**Architecture:** 在 `ScenicFacilityPresentation` 上建立数字人模型外键；后端统一校验并提供游客配置接口；后台复用模型目录接口；游客端在创建 Live2D 舞台前加载景点配置。

**Tech Stack:** Spring Boot、JPA、React、TypeScript、Ant Design、Live2D/PixiJS。

## Global Constraints

- 不增加新依赖。
- 不允许游客端回退到随机模型或 `MODEL_OPTIONS[0]`。
- 直播开启时必须同时满足数字人绑定和直播来源配置。
- 保留现有全局直播时间线和问答行为。

---

### Task 1: 后端绑定与游客配置

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/model/ScenicFacilityPresentation.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/ScenicFacilityContentRequest.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VisitorFacilityLiveConfigDto.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserLiveBroadcastController.java`
- Test: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`

- [ ] 写失败测试：开启直播但未绑定模型时拒绝保存，绑定 active 模型时保存成功。
- [ ] 增加模型外键、请求/响应字段和服务校验。
- [ ] 增加按 `facilityId` 查询的游客直播配置接口。
- [ ] 运行后端定向测试并确认通过。

### Task 2: 后台选择器

**Files:**
- Modify: `frontend-admin/src/api/scenic.ts`
- Modify: `frontend-admin/src/pages/scenic/components/FacilityContentDrawer.tsx`
- Test: `frontend-admin/src/pages/scenic/FacilityContentPage.test.mjs`

- [ ] 写失败契约测试：直播配置必须加载模型并渲染“直播数字人”选择器。
- [ ] 打开抽屉时并行加载 active 模型，保存 `liveDigitalHumanModelId`。
- [ ] 开启直播时增加必填校验和无模型提示。
- [ ] 运行前端管理端测试、lint 和构建。

### Task 3: 游客端严格加载绑定模型

**Files:**
- Modify: `frontend-visitor/src/api/liveBroadcast.ts`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.tsx`
- Test: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

- [ ] 写失败契约测试：配置请求携带 `facilityId`，模型加载不再引用 `MODEL_OPTIONS[0]`。
- [ ] 解析 `spotId` 并加载景点直播配置。
- [ ] 使用返回的 `modelPath` 创建 Live2D 模型；不可用时展示配置错误。
- [ ] 运行游客端测试、lint 和构建。

### Task 4: 联调验证

- [ ] 在后台为“灵山胜境”选择数字人并保存。
- [ ] 打开 `/live?spotId=1&spotName=灵山胜境`，确认加载的模型与后台一致。
- [ ] 清除绑定或关闭直播，确认游客端不回退其他模型。
