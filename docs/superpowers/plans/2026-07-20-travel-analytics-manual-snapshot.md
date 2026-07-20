# 旅游分析手动快照 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将旅游分析从“明细现场聚合 + 60 秒缓存 + 写后自动失效”改为“数据库持久化快照 + 管理员手动生成 + 所有消费者统一读取最新成功批次”。

**Architecture:** 使用 `travel_analytics_source_state` 提供可靠的数据与指标配置版本号，使用批次表和指标明细表原子发布 ADMIN/PUBLIC 共十条指标快照。原始记录仍实时维护；查询、模型测试和游客问答只走快照查询服务，无快照时明确不可用，旧快照在源数据变化后继续可读并标记 `STALE`。

**Tech Stack:** Java 17、Spring Boot 3.3、Spring Data JPA、MySQL/H2、Jackson、React 19、TypeScript 6、Ant Design 6、Node test、ESLint、Vite。

## Global Constraints

- 第一阶段仅由管理员手动生成快照，不增加定时刷新任务。
- 原始旅游记录列表继续实时增删改查；原始数据变化不得自动重算统计。
- 不提供快照历史管理、回滚或删除界面。
- 不引入新的第三方依赖或数据库专用物化视图。
- 一个成功批次必须原子包含五项指标的 ADMIN 与 PUBLIC 结果，共十条指标快照。
- 后台摘要、模型测试和游客统计问答只读取最新 `READY` 批次，不得回退现场聚合。
- 快照不得保存游客 ID、昵称、单条轨迹、单条消费或其他个人明细。
- 每个任务提交只暂存其列出的文件，保留工作区现有的其他修改。

---

## File Structure

### Persistence and versioning

- `model/TravelAnalyticsSourceState.java`：单行来源版本与刷新互斥锁载体。
- `model/TravelAnalyticsSnapshotBatch.java`：快照批次、来源水位、操作人和生命周期。
- `model/TravelAnalyticsMetricSnapshot.java`：一个批次中单个 scope/metric 的脱敏结果。
- `model/TravelAnalyticsSnapshotBatchStatus.java`：`BUILDING|READY|FAILED`。
- `repository/TravelAnalyticsSourceStateRepository.java`：单行状态读取与数据库悲观锁。
- `repository/TravelAnalyticsSnapshotBatchRepository.java`：最新成功/进行中批次查询。
- `repository/TravelAnalyticsMetricSnapshotRepository.java`：批次指标读取与完整性约束。
- `db/migration/manual/2026-07-20-travel-analytics-manual-snapshot.sql`：生产环境建表、索引与来源状态种子数据。

### Domain services and contracts

- `service/TravelAnalyticsMetricCalculator.java`：只负责从给定明细与阈值计算一个指标，不读数据库。
- `service/TravelAnalyticsSourceStateService.java`：锁定来源状态、递增版本、比较版本。
- `service/TravelAnalyticsSnapshotLifecycleService.java`：以独立事务创建 `BUILDING`、记录 `FAILED`。
- `service/TravelAnalyticsSnapshotTransactionService.java`：在单个事务内计算、写十条指标并切换 `READY`。
- `service/TravelAnalyticsSnapshotService.java`：刷新编排与最新快照查询。
- `service/TravelAnalyticsMetricService.java`：保留公共查询入口，但改为读取快照。
- `dto/TravelAnalyticsSnapshotStatus.java`：`NOT_CREATED|READY|STALE|REFRESHING`。
- `dto/TravelAnalyticsSnapshotResponse.java`：管理页面所需批次元数据、状态与 ADMIN 指标列表。

### HTTP and UI

- `controller/AdminTravelAnalyticsController.java`：新增快照读取/刷新端点并传入当前管理员。
- `frontend-admin/src/api/travelAnalytics.ts`：快照类型与 API。
- `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx`：明确区分重新加载和生成快照。
- `frontend-admin/src/pages/scenic/TravelAnalyticsPage.tsx`：明细 mutation 后只刷新来源状态，不生成快照。

---

### Task 1: 建立快照持久化与来源版本模型

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsSnapshotBatchStatus.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsSourceState.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsSnapshotBatch.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsMetricSnapshot.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsSourceStateRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsSnapshotBatchRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsMetricSnapshotRepository.java`
- Create: `backend-java/src/main/resources/db/migration/manual/2026-07-20-travel-analytics-manual-snapshot.sql`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/repository/TravelAnalyticsSnapshotPersistenceTests.java`

**Interfaces:**
- Produces: `findLockedById(Long id)`, `findFirstByStatusOrderByCompletedAtDescIdDesc(status)`, `findFirstByStatusOrderByCreatedAtDescIdDesc(status)`, `findByBatchIdOrderByScopeAscMetricAsc(Long batchId)`.
- Produces: database uniqueness for `(batch_id, scope, metric)` and a seeded source-state row with `id = 1`.

- [ ] **Step 1: Write the failing JPA persistence test**

Use `@DataJpaTest` to save one batch and ten snapshots, then assert the repository returns ten rows and rejects a duplicate `(batch_id, ADMIN, average_spend)` entry. Also lock source state id `1` and assert initial `dataVersion == 0` and `metricConfigVersion == 0`.

```java
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class TravelAnalyticsSnapshotPersistenceTests {
    @Test
    void storesExactlyOneMetricPerBatchScopeAndMetric() {
        TravelAnalyticsSnapshotBatch batch = batches.save(readyBatch());
        snapshots.saveAll(allTenSnapshots(batch));
        assertEquals(10, snapshots.findByBatchIdOrderByScopeAscMetricAsc(batch.getId()).size());
        assertThrows(DataIntegrityViolationException.class,
                () -> snapshots.saveAndFlush(snapshot(batch, ADMIN, AVERAGE_SPEND)));
    }
}
```

- [ ] **Step 2: Run the persistence test and verify failure**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsSnapshotPersistenceTests test`

Expected: FAIL because the entities and repositories do not exist.

- [ ] **Step 3: Implement entities, repositories, and manual migration**

Use explicit table/column names matching the design. Store `items_json` and `failure_summary` as `LONGTEXT`; use `LocalDateTime`; add the unique table constraint below.

```java
@Table(name = "travel_analytics_metric_snapshot", uniqueConstraints = @UniqueConstraint(
        name = "uk_travel_analytics_snapshot_metric",
        columnNames = {"batch_id", "scope", "metric"}))
```

Expose the lock query with a zero-wait hint so concurrent refreshes fail fast instead of queueing indefinitely.

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "0"))
@Query("select s from TravelAnalyticsSourceState s where s.id = :id")
Optional<TravelAnalyticsSourceState> findLockedById(@Param("id") Long id);
```

The manual SQL must create all three tables, the unique key and latest-batch indexes, then seed source state id `1` with versions `0` using `INSERT ... ON DUPLICATE KEY UPDATE id = id`.

- [ ] **Step 4: Run persistence tests**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsSnapshotPersistenceTests test`

Expected: PASS; one batch accepts ten unique metric rows and rejects duplicates.

- [ ] **Step 5: Commit the persistence foundation**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsSnapshotBatchStatus.java backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsSourceState.java backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsSnapshotBatch.java backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsMetricSnapshot.java backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsSourceStateRepository.java backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsSnapshotBatchRepository.java backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsMetricSnapshotRepository.java backend-java/src/main/resources/db/migration/manual/2026-07-20-travel-analytics-manual-snapshot.sql backend-java/src/test/java/com/digitalhuman/backend_java/repository/TravelAnalyticsSnapshotPersistenceTests.java
git commit -m "feat: 建立旅游统计快照持久化边界" -m "Constraint: 不引入数据库专用物化视图" -m "Rejected: 单项指标独立覆盖 | 无法保证十项结果原子切换" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 新指标必须纳入批次完整性与唯一约束" -m "Tested: TravelAnalyticsSnapshotPersistenceTests" -m "Not-tested: 尚未接入刷新服务" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 2: 将指标计算提取为无数据库副作用的计算器

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCalculator.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCalculatorTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java`

**Interfaces:**
- Consumes: existing `TravelAnalyticsValueParser` and `TravelAnalyticsMetricResponse`.
- Produces: `TravelAnalyticsMetricResponse calculate(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric, List<TravelAnalyticsRecord> records, int publicMinimumSampleSize)`.

- [ ] **Step 1: Write calculator characterization tests**

Move the current five metric calculation expectations out of `TravelAnalyticsMetricServiceTests` into calculator tests. Include ADMIN output, PUBLIC breakdown suppression below the configured threshold, invalid numeric/duration input exclusion, empty records and deterministic top-five ordering.

```java
var response = calculator.calculate(
        TravelAnalyticsAudience.PUBLIC,
        TravelAnalyticsMetric.POPULAR_ATTRACTIONS,
        records,
        10);
assertEquals(10, response.totalSamples());
assertEquals(9, response.validSamples());
assertTrue(response.items().isEmpty());
```

- [ ] **Step 2: Run the calculator test and verify failure**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricCalculatorTests test`

Expected: FAIL because `TravelAnalyticsMetricCalculator` does not exist.

- [ ] **Step 3: Extract the current computation without changing formulas**

Move `computeMetric`, the five `build*Response` methods, parsing helpers, warning/methodology helpers and stable ordering helpers into `TravelAnalyticsMetricCalculator`. Pass `publicMinimumSampleSize` explicitly; do not let the calculator load configuration or repositories.

Keep `TravelAnalyticsMetricService.queryMetric(...)` temporarily delegating through the old repository/cache path so this task is behavior-preserving; snapshot reads replace it in Task 4.

- [ ] **Step 4: Run calculator and existing metric tests**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricCalculatorTests,TravelAnalyticsMetricServiceTests,TravelAnalyticsValueParserTests test`

Expected: PASS with unchanged aggregation output.

- [ ] **Step 5: Commit the pure calculation boundary**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCalculator.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCalculatorTests.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java
git commit -m "refactor: 隔离旅游统计指标计算边界" -m "Constraint: 现有五项指标口径与隐私阈值保持不变" -m "Rejected: 在快照服务复制计算公式 | 会形成两套统计口径" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 计算器不得读取数据库或缓存" -m "Tested: 指标计算器、指标服务与值解析测试" -m "Not-tested: 尚未持久化快照" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 3: 用来源版本替换写后缓存失效

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSourceStateService.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsSourceStateServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigService.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsServiceTests.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigServiceTests.java`
- Delete: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheInvalidator.java`
- Delete: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheInvalidatorTests.java`

**Interfaces:**
- Consumes: `TravelAnalyticsSourceStateRepository.findLockedById(1L)`.
- Produces: `lockState()`, `markDataChanged(state)`, `markMetricConfigChanged(state)` and immutable version comparison values.

- [ ] **Step 1: Write failing source-version and mutation tests**

Assert create/update/delete and each successful import increment `dataVersion` exactly once in their existing transaction. Assert failed validation/import does not increment. Assert changing `minimumSampleSize` increments `metricConfigVersion`, while changing only `publicEnabled` does not.

```java
when(sourceStateService.lockState()).thenReturn(lockedState);
service.createRecord(request("visitor-1"));
verify(sourceStateService).markDataChanged(lockedState);
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsSourceStateServiceTests,TravelAnalyticsServiceTests,TravelAnalyticsAiConfigServiceTests test`

Expected: FAIL because write paths still invalidate the in-memory cache.

- [ ] **Step 3: Implement transactional version increments**

At the start of each mutation transaction, lock state id `1`; after the domain write succeeds, increment the matching version on that locked entity. For `updateConfig`, compare the previous and requested minimum sample size before incrementing `metricConfigVersion`.

```java
TravelAnalyticsSourceState state = sourceStateService.lockState();
TravelAnalyticsRecord saved = recordRepository.save(entity);
sourceStateService.markDataChanged(state);
return saved;
```

Remove `TravelAnalyticsMetricCacheInvalidator` from constructors and delete its tests.

- [ ] **Step 4: Run mutation tests**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsSourceStateServiceTests,TravelAnalyticsServiceTests,TravelAnalyticsAiConfigServiceTests test`

Expected: PASS; successful mutations increment once and failures increment zero times.

- [ ] **Step 5: Commit source versioning**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSourceStateService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigService.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsSourceStateServiceTests.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsServiceTests.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigServiceTests.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheInvalidator.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheInvalidatorTests.java
git commit -m "refactor: 以来源版本标记旅游统计待刷新状态" -m "Constraint: 明细写入不得自动生成或删除快照" -m "Rejected: 比较记录数与最大更新时间 | 无法可靠覆盖全部删除和回填场景" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 新增明细写路径必须在同一事务递增 dataVersion" -m "Tested: 来源状态、明细服务与 AI 配置服务测试" -m "Not-tested: 尚未接入快照状态读取" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 4: 原子生成并读取最新成功快照

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsSnapshotStatus.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsSnapshotResponse.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotLifecycleService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotTransactionService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotService.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java`
- Delete: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCache.java`
- Delete: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheTests.java`

**Interfaces:**
- Produces: `TravelAnalyticsSnapshotResponse getLatestSnapshot()`.
- Produces: `TravelAnalyticsSnapshotResponse refresh(AuthSession admin)`.
- Produces: `TravelAnalyticsMetricResponse getMetric(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric)`.
- Response fields: `status`, `batchId`, `createdAt`, `completedAt`, `createdBy`, `sourceRecordCount`, `currentRecordCount`, `metrics`, `failureMessage`; nullable batch fields are absent only for `NOT_CREATED`.

- [ ] **Step 1: Write failing snapshot lifecycle tests**

Cover: no snapshot; successful refresh writes ten unique rows and publishes `READY`; stale versions return `STALE`; a `BUILDING` batch returns `REFRESHING`; calculation/write failure rolls back metric rows and records `FAILED`; old `READY` remains readable; a second refresh conflict maps to HTTP 409 semantics.

```java
TravelAnalyticsSnapshotResponse response = service.refresh(admin());
assertEquals(TravelAnalyticsSnapshotStatus.READY, response.status());
assertEquals(10, metricSnapshots.findByBatchIdOrderByScopeAscMetricAsc(response.batchId()).size());
verify(calculator, times(10)).calculate(any(), any(), same(records), eq(10));
```

- [ ] **Step 2: Run snapshot tests and verify failure**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsSnapshotServiceTests test`

Expected: FAIL because lifecycle, transaction and query services do not exist.

- [ ] **Step 3: Implement lifecycle and transaction boundaries**

`TravelAnalyticsSnapshotLifecycleService.createBuilding(...)` and `markFailed(...)` use `REQUIRES_NEW`. Creation locks source state, rejects an existing `BUILDING` batch with `ResponseStatusException(CONFLICT, "统计快照正在生成")`, and saves the administrator username/display name.

`TravelAnalyticsSnapshotTransactionService.populateAndPublish(batchId)` uses one transaction: lock source state; read records/config; compute all enum combinations; serialize only `items`; save ten rows; assert exact completeness; copy source versions/count/max-updated-at to the batch; switch to `READY`.

```java
for (TravelAnalyticsAudience scope : TravelAnalyticsAudience.values()) {
    for (TravelAnalyticsMetric metric : TravelAnalyticsMetric.values()) {
        responses.add(calculator.calculate(scope, metric, records, config.getMinimumSampleSize()));
    }
}
if (responses.size() != 10) throw new IllegalStateException("统计快照指标不完整");
```

The outer `TravelAnalyticsSnapshotService.refresh` catches runtime failures, calls `markFailed` with a sanitized bounded summary, then rethrows. It never converts a failed batch to readable data.

- [ ] **Step 4: Replace metric cache reads with snapshot reads**

`TravelAnalyticsMetricService.queryMetric` retains public whitelist/access checks, then delegates to `snapshotService.getMetric`. When no `READY` batch exists, throw `ResponseStatusException(SERVICE_UNAVAILABLE, "统计快照尚未生成")`. Deserialize `items_json` with `ObjectMapper` and reconstruct the existing `TravelAnalyticsMetricResponse` contract.

Delete the cache implementation and cache tests. Do not keep a hidden fallback to `TravelAnalyticsRecordRepository`.

- [ ] **Step 5: Run snapshot, metric and chat service tests**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsSnapshotServiceTests,TravelAnalyticsMetricServiceTests,GuideServiceTests test`

Expected: PASS; every consumer observes the same latest `READY` batch.

- [ ] **Step 6: Commit snapshot generation and reads**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsSnapshotStatus.java backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsSnapshotResponse.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotLifecycleService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotTransactionService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCache.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsSnapshotServiceTests.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheTests.java
git commit -m "feat: 让旅游统计只读取手动发布快照" -m "Constraint: 无成功快照时不得回退现场聚合" -m "Rejected: 继续保留六十秒缓存 | 无法提供稳定可审计的数据版本" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: 所有统计消费者必须只读取最新 READY 批次" -m "Tested: 快照生命周期、指标服务与游客问答服务测试" -m "Not-tested: 尚未接入管理端刷新按钮" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 5: 暴露管理员快照接口并锁定权限

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java`

**Interfaces:**
- Consumes: `TravelAnalyticsSnapshotService.getLatestSnapshot()` and `refresh(AuthSession)`.
- Produces: `GET /api/admin/travel-analytics/snapshot` and `POST /api/admin/travel-analytics/snapshot/refresh`.

- [ ] **Step 1: Write failing controller and interceptor tests**

Assert ADMIN and Observer can GET snapshot status; only ADMIN can POST refresh; POST passes the request `AuthSession` to the service; no snapshot metric endpoint returns 503; public-disabled behavior remains 404; invalid metric remains 400.

```java
mvc.perform(post("/api/admin/travel-analytics/snapshot/refresh")
        .header("Authorization", "Bearer admin"))
        .andExpect(status().isOk());
verify(snapshotService).refresh(argThat(session -> session.getRole() == UserRole.ADMIN));
```

- [ ] **Step 2: Run controller tests and verify failure**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests test`

Expected: FAIL with 404 for the new snapshot routes.

- [ ] **Step 3: Implement endpoints and current-admin extraction**

Follow `AdminScenicKnowledgePublicationController.requireAdmin`: read `AuthInterceptor.REQUEST_ATTR_AUTH_SESSION`, reject missing session with 401 and non-ADMIN with 403, then call refresh. Keep GET accessible to Observer through the existing interceptor policy.

```java
@PostMapping("/snapshot/refresh")
public TravelAnalyticsSnapshotResponse refreshSnapshot(HttpServletRequest request) {
    return snapshotService.refresh(requireAdmin(request));
}
```

- [ ] **Step 4: Run controller/security regression**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests,AuthControllerTests test`

Expected: PASS; Observer remains read-only and ADMIN can publish.

- [ ] **Step 5: Commit HTTP contract**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java
git commit -m "feat: 提供旅游统计快照手动刷新接口" -m "Constraint: Observer 仅可读取快照状态" -m "Rejected: 仅依赖前端隐藏刷新按钮 | 无法形成服务端权限边界" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 刷新端点必须校验请求中的 ADMIN 会话" -m "Tested: 旅游统计控制器与认证回归测试" -m "Not-tested: 尚未连接管理端页面" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 6: 将管理页面改成明确的手动快照交互

**Files:**
- Modify: `frontend-admin/src/api/travelAnalytics.ts`
- Modify: `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx`
- Modify: `frontend-admin/src/pages/scenic/TravelAnalyticsPage.tsx`
- Modify: `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`

**Interfaces:**
- Consumes: `GET /snapshot`, `POST /snapshot/refresh`, existing AI config and metric-test endpoints.
- Produces: `getTravelAnalyticsSnapshot()` and `refreshTravelAnalyticsSnapshot()`.
- Produces: panel handle `reloadSnapshotStatus(): Promise<void>`; it never generates a snapshot.

- [ ] **Step 1: Replace old source-contract assertions with failing snapshot assertions**

Assert the API exposes both snapshot routes; the panel renders “重新加载快照” and ADMIN-only “生成最新快照”; `NOT_CREATED`/`STALE`/`REFRESHING` copy exists; mutation paths call `reloadSnapshotStatus()` but never call `refreshTravelAnalyticsSnapshot()`.

```js
assert.match(apiSource, /axios\.get<TravelAnalyticsSnapshotResponse>\('\/api\/admin\/travel-analytics\/snapshot'\)/)
assert.match(apiSource, /axios\.post<TravelAnalyticsSnapshotResponse>\('\/api\/admin\/travel-analytics\/snapshot\/refresh'\)/)
assert.doesNotMatch(pageSource, /refreshTravelAnalyticsSnapshot/)
```

- [ ] **Step 2: Run frontend contract test and verify failure**

Run: `cd frontend-admin && node --test src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`

Expected: FAIL because the snapshot API and explicit buttons are absent.

- [ ] **Step 3: Add TypeScript API types and calls**

Define `TravelAnalyticsSnapshotStatus`, nullable batch metadata, `currentRecordCount`, `metrics`, and `failureMessage`. Keep the existing metric response type so test/model-result rendering remains compatible.

- [ ] **Step 4: Implement panel states and actions**

On mount and “重新加载快照”, call the snapshot overview endpoint. Only “生成最新快照” calls POST, then replaces the overview with the returned `READY` result. Disable generation for Observer or while status is `REFRESHING`.

Render:

- `NOT_CREATED`: “尚未生成统计快照，游客统计问答暂不可用”。
- `STALE`: “源数据已变化，当前游客问答仍使用此快照”。
- `REFRESHING`: keep old summaries visible when returned and show progress.
- `READY`: completion time, operator, source record count and five ADMIN summaries.
- Failure: preserve existing overview and show the backend-safe failure message or a stable fallback.

- [ ] **Step 5: Stop mutation paths from publishing or auto-recomputing**

Rename the imperative handle from `refresh` to `reloadSnapshotStatus`. After create/update/delete/import success, call only this status reload so the page can switch to `STALE`; do not fetch five metric endpoints and do not call the POST refresh endpoint.

- [ ] **Step 6: Run focused frontend test, lint and build**

Run: `cd frontend-admin && node --test src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`

Expected: PASS.

Run: `cd frontend-admin && npm run lint`

Expected: PASS with zero ESLint errors.

Run: `cd frontend-admin && npm run build`

Expected: PASS and Vite production bundle generated.

- [ ] **Step 7: Commit manual snapshot UI**

```bash
git add frontend-admin/src/api/travelAnalytics.ts frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx frontend-admin/src/pages/scenic/TravelAnalyticsPage.tsx frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.test.mjs
git commit -m "feat: 让旅游分析由管理员手动生成快照" -m "Constraint: 明细操作只更新待刷新状态，不得自动发布" -m "Rejected: 复用原刷新摘要按钮 | 无法区分重新读取与重新生成" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 只有生成最新快照按钮可以调用刷新 POST 接口" -m "Tested: 管理端合同测试、ESLint 与 Vite production build" -m "Not-tested: 尚未执行真实浏览器手动冒烟" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 7: 全链路回归与迁移验证

**Files:**
- Modify only if a failing regression exposes a defect in files already owned by Tasks 1–6.
- Create: `docs/verification/2026-07-20-travel-analytics-manual-snapshot.md`

**Interfaces:**
- Consumes: all completed snapshot persistence, service, HTTP and UI contracts.
- Produces: reproducible verification evidence and known gaps.

- [ ] **Step 1: Run the complete backend travel analytics suite**

Run: `cd backend-java && mvn -q -Dtest='TravelAnalytics*Tests,GuideServiceTests' test`

Expected: PASS; no remaining tests refer to `TravelAnalyticsMetricCache` or automatic invalidation.

- [ ] **Step 2: Run the full backend test suite**

Run: `cd backend-java && mvn -q test`

Expected: PASS with zero failures/errors.

- [ ] **Step 3: Run all admin source tests**

Run: `cd frontend-admin && node --test src/pages/*.test.mjs src/pages/scenic/*.test.mjs src/theme/*.test.mjs`

Expected: PASS for every discovered test file.

- [ ] **Step 4: Run admin lint and production build again**

Run: `cd frontend-admin && npm run lint && npm run build`

Expected: PASS.

- [ ] **Step 5: Validate the manual SQL migration against MySQL syntax**

Review the generated SQL with `git diff --check` and, when the local configured MySQL instance is available, execute it against a disposable schema twice. The first run must create/seed all tables; the second run must be idempotent and leave exactly one source-state row.

- [ ] **Step 6: Record verification evidence**

Create `docs/verification/2026-07-20-travel-analytics-manual-snapshot.md` with exact commands, pass counts, migration result, and any environment-only gaps. Include a manual API smoke sequence: no snapshot → POST refresh → READY → mutate record → STALE → old metric unchanged → POST refresh → new READY.

- [ ] **Step 7: Commit verification evidence**

```bash
git add docs/verification/2026-07-20-travel-analytics-manual-snapshot.md
git commit -m "test: 记录旅游统计手动快照验证证据" -m "Constraint: 完成声明必须建立在新鲜回归证据上" -m "Rejected: 只运行旅游统计定向测试 | 无法发现跨模块回归" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 后续指标变更必须同步更新快照与隐私回归" -m "Tested: Maven 全量、管理端 Node 测试、ESLint、Vite build 与迁移检查" -m "Not-tested: 按验证文档记录的环境缺口" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

## Completion Checklist

- [ ] 原始记录变更后，在手动刷新前后台摘要、模型测试和游客问答保持旧值。
- [ ] 一次成功刷新原子发布同一批次的十条快照。
- [ ] 无快照时不隐式聚合，后台与游客得到明确不可用状态。
- [ ] ADMIN 可刷新，Observer 只读，普通游客不能访问管理快照端点。
- [ ] 并发或失败刷新不污染最新 `READY` 快照。
- [ ] 页面准确展示 `NOT_CREATED|READY|STALE|REFRESHING` 与来源元数据。
- [ ] 后端测试、管理端测试、ESLint、生产构建和迁移验证均有新鲜证据。
