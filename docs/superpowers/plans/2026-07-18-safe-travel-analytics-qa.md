# 脱敏旅游统计问答 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为游客端提供五类白名单旅游统计问答，为后台提供受控测试能力，同时保证模型上下文不包含游客明细。

**Architecture:** 新建独立统计聚合服务，把现有字符串字段规范化为数值和分组结果；公开接口只接受枚举指标，不接受 SQL、字段名或任意过滤表达式。聊天服务以确定性关键词分类器识别统计意图，命中时把结构化统计摘要作为受控上下文，与既有 MaxKB 来源共同交给模型。AI 权限配置持久化为单例配置，游客与后台使用不同服务入口。

**Tech Stack:** Java 21、Spring Boot、Spring Data JPA、JUnit 5、Mockito、React 19、TypeScript、Ant Design

## Global Constraints

- 游客端只开放热门景点、平均停留、平均消费、平均满意度、常见客群。
- 统计接口不得返回 `tourist_id`、昵称或任何原始记录。
- 细分统计默认最小有效样本量为 10。
- 模型不得生成或执行任意 SQL。
- 每个结果必须包含总样本数、有效样本数、统计截至时间和口径。
- 现有导入、CRUD、游客聊天和流式聊天行为必须保持兼容。
- 不新增第三方依赖；首期使用进程内短时缓存。
- 不修改或提交现有 `frontend-visitor/src/pages/MapPage*` 工作区改动。

---

### Task 1: 建立指标枚举、响应契约和数据规范化器

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsMetric.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsAudience.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsMetricResponse.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsValueParser.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsValueParserTests.java`

**Interfaces:**
- Produces: `TravelAnalyticsMetric` 五个固定枚举值与 `TravelAnalyticsAudience.PUBLIC|ADMIN`。
- Produces: `Optional<BigDecimal> parseMoney(String)`、`Optional<Duration> parseDuration(String)`、`Optional<BigDecimal> parseSatisfaction(String)`、`Optional<LocalDate> parseDate(String)`。
- Produces: `TravelAnalyticsMetricResponse(metric, scope, totalSamples, validSamples, asOf, items, warning)`；items 只能包含聚合标签和值。

- [ ] **Step 1: 写失败测试覆盖中文单位与无效值**

```java
assertEquals(new BigDecimal("128.50"), parser.parseMoney("¥128.50元").orElseThrow());
assertEquals(Duration.ofMinutes(90), parser.parseDuration("1小时30分钟").orElseThrow());
assertEquals(new BigDecimal("4.5"), parser.parseSatisfaction("4.5/5").orElseThrow());
assertTrue(parser.parseMoney("未知").isEmpty());
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsValueParserTests test`

Expected: FAIL，解析器不存在。

- [ ] **Step 3: 实现无副作用解析器与固定 DTO**

解析器只做格式清洗和单位换算，不访问数据库；金额统一为元，时长统一为分钟，满意度统一为 5 分制。未知格式返回 `Optional.empty()`，禁止静默当作 0。

- [ ] **Step 4: 运行解析测试**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsValueParserTests test`

Expected: PASS。

- [ ] **Step 5: 提交指标基础**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsMetric.java backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsAudience.java backend-java/src/main/java/com/digitalhuman/backend_java/dto/TravelAnalyticsMetricResponse.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsValueParser.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsValueParserTests.java
git commit -m "feat: 建立脱敏旅游统计指标契约" -m "Constraint: 无法解析的行为字段不得按零值计入" -m "Rejected: 直接让模型解释原始字符串 | 口径不可控且会暴露明细" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 新指标必须使用枚举并声明统计口径" -m "Tested: TravelAnalyticsValueParserTests" -m "Not-tested: 尚未接入数据库" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 2: 实现五类脱敏聚合与最小样本量

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsRecordRepository.java`

**Interfaces:**
- Consumes: Task 1 解析器和 DTO。
- Produces: `TravelAnalyticsMetricResponse queryMetric(TravelAnalyticsAudience audience, TravelAnalyticsMetric metric)`；PUBLIC 强制执行五项白名单和最小样本量，ADMIN 仍只返回聚合结果。

- [ ] **Step 1: 写失败测试覆盖隐私、样本阈值和口径**

```java
var response = service.queryMetric(TravelAnalyticsAudience.PUBLIC, TravelAnalyticsMetric.AVERAGE_SPEND);
assertEquals(12, response.totalSamples());
assertEquals(10, response.validSamples());
assertFalse(objectMapper.writeValueAsString(response).contains("tourist_id"));
assertFalse(objectMapper.writeValueAsString(response).contains("user_nickname"));
```

另写 9 条有效数据的细分测试，断言 `items` 为空且 `warning` 为“样本不足”。热门景点和客群只返回前 5 项。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricServiceTests test`

Expected: FAIL，聚合服务不存在。

- [ ] **Step 3: 实现白名单聚合**

服务只从 repository 读取实体并在服务内映射成聚合累加器；离开方法前丢弃实体引用。`average_spend` 优先使用可解析的 `total_cost`，缺失时才累加五类分项费用。`asOf` 使用参与统计记录的最大 `updatedAt`。

- [ ] **Step 4: 运行聚合测试**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricServiceTests test`

Expected: PASS。

- [ ] **Step 5: 提交聚合服务**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricService.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricServiceTests.java backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsRecordRepository.java
git commit -m "feat: 提供五类脱敏旅游统计聚合" -m "Constraint: 游客统计最小有效样本量为十条" -m "Rejected: 返回明细后由模型聚合 | 会突破隐私边界" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 聚合响应不得新增个体标识字段" -m "Tested: TravelAnalyticsMetricServiceTests" -m "Not-tested: 大数据量性能在集成任务验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 3: 持久化 AI 数据权限并开放游客/后台受控接口

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsAiConfig.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsAiConfigRepository.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigService.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserTravelAnalyticsController.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java`

**Interfaces:**
- Produces: `GET /api/user/travel-analytics/metrics/{metric}`。
- Produces: `GET|PUT /api/admin/travel-analytics/ai-config` 与 `POST /api/admin/travel-analytics/metrics/{metric}/test`。
- AI 配置固定主键 `default`，字段为 `publicEnabled`、`minimumSampleSize=10`、`updatedAt`。

- [ ] **Step 1: 写失败 controller 测试**

```java
mockMvc.perform(get("/api/user/travel-analytics/metrics/average_spend")
        .header("Authorization", userToken))
    .andExpect(status().isOk())
    .andExpect(jsonPath("$.validSamples").value(10))
    .andExpect(jsonPath("$.tourist_id").doesNotExist());
```

另断言关闭 `publicEnabled` 后游客端返回 404 或 403；Observer 的 PUT 被现有 `AuthInterceptor` 拒绝。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests test`

Expected: FAIL，controller 和配置不存在。

- [ ] **Step 3: 实现配置与受控端点**

游客 controller 只接受 Spring 枚举转换后的 `TravelAnalyticsMetric`；不添加 `Map<String,Object>` 查询参数。管理员测试端点复用同一聚合服务，但在服务内显式传入 `Audience.ADMIN`。

- [ ] **Step 4: 运行 controller 测试**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricControllerTests test`

Expected: PASS。

- [ ] **Step 5: 提交权限与接口**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/model/TravelAnalyticsAiConfig.java backend-java/src/main/java/com/digitalhuman/backend_java/repository/TravelAnalyticsAiConfigRepository.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsAiConfigService.java backend-java/src/main/java/com/digitalhuman/backend_java/controller/UserTravelAnalyticsController.java backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminTravelAnalyticsController.java backend-java/src/test/java/com/digitalhuman/backend_java/controller/TravelAnalyticsMetricControllerTests.java
git commit -m "feat: 分离游客与后台统计数据权限" -m "Constraint: 游客接口只接受固定指标枚举" -m "Rejected: 依赖前端隐藏高级参数 | 无法形成服务端权限边界" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: Observer 继续保持只读权限" -m "Tested: TravelAnalyticsMetricControllerTests" -m "Not-tested: 尚未接入聊天路由" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 4: 添加短时缓存并在数据变更后失效

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCache.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheTests.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsServiceTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsService.java`

**Interfaces:**
- Produces: `getOrCompute(Audience audience, TravelAnalyticsMetric metric, Supplier<Response> supplier)`，TTL 固定 60 秒。
- Produces: `invalidateAll()`，由 create/update/delete/import 成功路径调用。

- [ ] **Step 1: 写失败测试锁定 TTL 与失效**

```java
assertSame(first, cache.getOrCompute(PUBLIC, metric, supplier));
cache.invalidateAll();
assertNotSame(first, cache.getOrCompute(PUBLIC, metric, supplier));
verify(supplier, times(2)).get();
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricCacheTests test`

Expected: FAIL，缓存不存在。

- [ ] **Step 3: 实现有界进程内缓存并接入变更路径**

使用 `ConcurrentHashMap<CacheKey, CacheEntry>`；键只由 audience 和 metric 组成，最大 10 个条目。`TravelAnalyticsService` 在事务成功保存或删除后调用 `invalidateAll()`；导入完成后只调用一次。

- [ ] **Step 4: 运行缓存和导入回归**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsMetricCacheTests,TravelAnalyticsServiceTests test`

Expected: PASS；`TravelAnalyticsServiceTests` 覆盖 create、update、delete 和 import 成功后调用 `invalidateAll()`，导入批次只失效一次。

- [ ] **Step 5: 提交缓存失效**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCache.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsMetricCacheTests.java backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsService.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsServiceTests.java
git commit -m "perf: 缓存脱敏统计并在数据变更后失效" -m "Constraint: 缓存最长保留六十秒且数据修改必须立即失效" -m "Rejected: 引入 Redis | 首期规模不需要新增基础设施" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 新增统计维度时必须纳入缓存键" -m "Tested: 指标缓存与旅游数据服务测试" -m "Not-tested: 多实例缓存一致性不在首期范围" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 5: 把白名单统计接入普通与流式聊天

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifier.java`
- Create: `backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifierTests.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/GuideService.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/GuideServiceTests.java`

**Interfaces:**
- Produces: `Classification classify(String question)`；`Classification` 包含 `kind=NONE|METRIC|PERSONAL_DATA_REQUEST` 和可空的五项指标枚举。
- Consumes: Task 2 `queryMetric(PUBLIC, metric)`；将结果转成不含明细的 `GuideSourceDto`，`knowledgeName` 固定为“脱敏旅游统计”。

- [ ] **Step 1: 写分类器失败测试**

```java
assertEquals(AVERAGE_STAY_DURATION, classifier.classify("大家一般会玩多久？").metric());
assertEquals(POPULAR_ATTRACTIONS, classifier.classify("哪个景点最热门？").metric());
assertEquals(PERSONAL_DATA_REQUEST, classifier.classify("告诉我游客张三花了多少钱").kind());
```

- [ ] **Step 2: 写 GuideService 失败测试**

普通与流式聊天各断言一次：统计问题调用 `queryMetric(PUBLIC, metric)`；上下文包含统计截至时间；上下文不含 `tourist_id` 和昵称；个人数据请求不调用模型并返回固定拒绝语；非统计问题保持现有 MaxKB hit-test。

- [ ] **Step 3: 运行测试确认失败**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests test`

Expected: FAIL，分类器与统计依赖不存在。

- [ ] **Step 4: 实现确定性路由与统计上下文**

分类器只匹配明确的群体统计表达；包含“某个游客、游客 ID、昵称、明细、轨迹”等个体请求时返回拒绝标记，由 `GuideService` 注入“不能提供个人数据”的系统约束。聊天请求不得接收客户端传入的指标枚举来提升权限。

- [ ] **Step 5: 运行聊天回归**

Run: `cd backend-java && mvn -q -Dtest=TravelAnalyticsIntentClassifierTests,GuideServiceTests,UserGuideControllerTests,AdminGuideControllerTests test`

Expected: PASS。

- [ ] **Step 6: 提交聊天编排**

```bash
git add backend-java/src/main/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifier.java backend-java/src/test/java/com/digitalhuman/backend_java/service/TravelAnalyticsIntentClassifierTests.java backend-java/src/main/java/com/digitalhuman/backend_java/service/GuideService.java backend-java/src/test/java/com/digitalhuman/backend_java/service/GuideServiceTests.java
git commit -m "feat: 让导览问答安全引用脱敏旅游统计" -m "Constraint: 客户端不能选择超出游客白名单的统计指标" -m "Rejected: 让大模型生成 SQL | 难以保证字段与权限边界" -m "Confidence: high" -m "Scope-risk: broad" -m "Directive: 普通与流式聊天必须保持相同统计路由" -m "Tested: 分类器、GuideService 与 controller 定向测试" -m "Not-tested: 真实模型措辞在集成任务验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 6: 在旅游分析页增加 AI 数据权限与测试回答

**Files:**
- Modify: `frontend-admin/src/api/travelAnalytics.ts`
- Modify: `frontend-admin/src/pages/scenic/TravelAnalyticsPage.tsx`
- Create: `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx`
- Create: `frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`

**Interfaces:**
- Consumes: Task 3 管理端配置和测试端点。
- Produces: 游客统计开关、五项白名单说明、样本/更新时间摘要和测试输出。

- [ ] **Step 1: 写失败契约测试**

```js
assert.match(apiSource, /getTravelAnalyticsAiConfig/)
assert.match(apiSource, /updateTravelAnalyticsAiConfig/)
assert.match(apiSource, /testTravelAnalyticsMetric/)
assert.match(panelSource, /游客 ID、昵称和单条记录不会提供给模型/)
```

Run: `cd frontend-admin && node src/pages/scenic/TravelAnalyticsAiPanel.test.mjs`

Expected: FAIL，面板不存在。

- [ ] **Step 2: 实现 API 与独立面板组件**

面板加载配置和五项指标摘要；管理员可保存开关，Observer 只读。测试选择器仅包含五个枚举，结果展示 `validSamples/totalSamples/asOf/warning/items`，不渲染原始记录。

- [ ] **Step 3: 接入现有页面并在数据变化后刷新摘要**

Excel 导入、记录创建、编辑和删除成功后调用面板暴露的 `refresh()`，与后端缓存失效保持一致。

- [ ] **Step 4: 运行前端验证**

Run: `cd frontend-admin && node src/pages/scenic/TravelAnalyticsAiPanel.test.mjs && npm run lint && npm run build`

Expected: 全部 PASS。

- [ ] **Step 5: 提交管理端 AI 数据权限**

```bash
git add frontend-admin/src/api/travelAnalytics.ts frontend-admin/src/pages/scenic/TravelAnalyticsPage.tsx frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.tsx frontend-admin/src/pages/scenic/TravelAnalyticsAiPanel.test.mjs
git commit -m "feat: 管理旅游统计的模型访问权限" -m "Constraint: 管理端测试也只能通过受控聚合接口" -m "Rejected: 增加导入知识库按钮 | 统计会过期且包含隐私明细" -m "Confidence: high" -m "Scope-risk: moderate" -m "Directive: 页面不得展示或发送任意查询表达式" -m "Tested: 页面契约测试；ESLint；Vite build" -m "Not-tested: 浏览器真实模型回答在最终任务验证" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 7: 完整隐私与问答验证

**Files:**
- Create: `docs/verification/2026-07-18-safe-travel-analytics-qa.md`

- [ ] **Step 1: 运行后端完整测试**

Run: `cd backend-java && mvn test`

Expected: BUILD SUCCESS。

- [ ] **Step 2: 运行管理端完整检查**

Run: `cd frontend-admin && npm run lint && npm run build`

Expected: ESLint 0 error，Vite build 成功。

- [ ] **Step 3: 执行隐私负向验证**

用 USER token 请求五个指标，确认响应 JSON 不包含 `tourist_id`、`user_nickname` 或原始行；请求未知指标返回 400；询问单个游客消费或轨迹时，普通和流式聊天均拒绝明细回答。

- [ ] **Step 4: 执行五类模型问答验证**

分别询问热门景点、平均停留、平均消费、平均满意度和常见客群；记录回答、有效样本数和截至时间。少于 10 条有效样本的细分查询必须显示“样本不足”。

- [ ] **Step 5: 记录性能与缓存结果**

记录首次计算和缓存命中的耗时；编辑一条旅游记录后重新请求，确认统计立即变化而不是等待 60 秒。

- [ ] **Step 6: 提交验证记录**

```bash
git add docs/verification/2026-07-18-safe-travel-analytics-qa.md
git commit -m "test: 记录脱敏旅游统计问答验证" -m "Constraint: 验证记录不得包含真实游客标识" -m "Rejected: 只验证正常统计问题 | 无法证明隐私负向边界" -m "Confidence: high" -m "Scope-risk: narrow" -m "Directive: 新增统计指标时必须补隐私负向用例" -m "Tested: Maven；管理端 lint/build；五类问答；隐私拒绝；缓存失效" -m "Not-tested: 无" -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```
