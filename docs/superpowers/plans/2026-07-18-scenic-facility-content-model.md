# 景点正式主数据与内容绑定 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将结构化导入资料、口播语音和直播配置统一关联到正式 `ScenicFacility`，并提供字段级匹配、应用与维护界面。

**Architecture:** `ScenicFacility` 保存地图高频字段，一对一详情表保存结构化文化字段，一对一呈现表保存语音直播配置；导入记录仅作为可追溯来源并记录匹配状态。兼容旧 `spotId` 数据，新增流程统一使用 `facilityId`。

**Tech Stack:** Java 21、Spring Boot、Spring Data JPA、React、TypeScript、Ant Design、Node contract tests。

## Global Constraints

- 不新增第三方依赖。
- 不删除现有导入记录、口播版本或游客呈现配置。
- 结构化业务内容必须按独立字段存储，不使用单一详情文本或通用 JSON。
- 地图和游客端继续以 `ScenicFacility` 为唯一正式点位。
- 字段覆盖必须由管理员确认并保留可回滚快照。

---

### Task 1: 正式点位内容领域模型

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/ScenicFacilityDetail.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/ScenicFacilityPresentation.java`
- Create repositories and DTOs in the matching backend packages.
- Modify: `ScenicFacility.java`, `ScenicFacilityDto.java`, `ScenicFacilityRequestDto.java`, `AdminScenicFacilityService.java`.
- Test: `backend-java/src/test/java/com/digitalhuman/backend_java/service/AdminScenicFacilityServiceTests.java`.

- [ ] Write failing tests for spot code, independent detail fields and presentation validation.
- [ ] Run the target test and confirm failures are caused by missing behavior.
- [ ] Implement entities, repositories, DTO mapping and validation.
- [ ] Run the target test and confirm it passes.

### Task 2: 导入匹配与字段级应用

**Files:**
- Modify: `ScenicStructuredSpotRecord.java`, its repository/service/controller and DTOs.
- Create apply request, preview response and application snapshot model/repository.
- Test: `ScenicStructuredSpotServiceTests.java`.

- [ ] Write failing tests for code/name suggestions, one-to-one binding, fill-empty and selected-field application.
- [ ] Run the target test and confirm red.
- [ ] Implement preview, bind, apply, snapshot and rollback services.
- [ ] Run the target test and confirm green.

### Task 3: 口播迁移到 facilityId

**Files:**
- Modify voice-script entity, DTOs, repository, generation and scene services.
- Test: voice-script service and generation tests.

- [ ] Write failing tests proving generated/manual scripts belong to a facility and legacy spot IDs remain readable.
- [ ] Confirm red, implement the compatibility relation, then confirm green.

### Task 4: 设施内容配置界面

**Files:**
- Modify `frontend-admin/src/api/scenic.ts`, `FacilityListPage.tsx`, `SpotAddPage.tsx`.
- Create focused content configuration components under `frontend-admin/src/pages/scenic/components/`.
- Test: `FacilityContentPage.test.mjs`.

- [ ] Write a failing contract test for structured fields, voice binding and live configuration.
- [ ] Confirm red, implement the tabs and API integration, then confirm green.

### Task 5: 导入匹配界面

**Files:**
- Modify `frontend-admin/src/api/scenicStructured.ts` and `ScenicStructuredPage.tsx`.
- Test: `ScenicStructuredPage.test.mjs`.

- [ ] Write a failing contract test for match status, candidate selection, field diff and apply modes.
- [ ] Confirm red, implement the import-only workflow and remove presentation controls, then confirm green.

### Task 6: 全量验证

- [ ] Run `mvn test` with zero failures and errors.
- [ ] Run all frontend Node contract tests.
- [ ] Run `npm run lint` with zero errors.
- [ ] Run `npm run build` with exit code 0.
- [ ] Review the diff against the approved design and verify no data-destructive migration exists.
