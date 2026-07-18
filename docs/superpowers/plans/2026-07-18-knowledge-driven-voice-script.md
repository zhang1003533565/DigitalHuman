# 知识库驱动的景点口播 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立单景点从多知识库生成或手工维护口播、合成语音、版本发布，并由景点主动绑定语音和直播来源的完整后台流程。

**Architecture:** 扩展现有 `VoiceScriptScene` 保存生成来源与音频资产，新增编排服务复用 MaxKB 检索、AI basic-chat 和 TTS；扩展 `ScenicStructuredSpotRecord` 保存游客呈现配置，并在服务层校验绑定状态。管理端继续使用现有两个页面，分别承担口播生产和景点绑定。

**Tech Stack:** Java 21、Spring Boot、Spring Data JPA、OkHttp、React、TypeScript、Ant Design、Node contract tests。

## Global Constraints

- 主流程只做单景点生成，不增加批量生成。
- AI 来源支持多知识库、多文档，景点结构化数据始终自动带入。
- 发布前必须存在与当前文本摘要一致的合成音频。
- 历史版本不可覆盖，回滚创建新的草稿版本。
- 摄像头真实分发需要外部 WebRTC/直播网关，本期仅保存推流通道并做设备与配置校验。
- 不新增第三方依赖。

---

### Task 1: 口播版本与音频状态领域能力

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/model/VoiceScriptScene.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/VoiceScriptSceneRepository.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/VoiceScriptSceneService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminVoiceScriptController.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VoiceScriptSynthesizeRequest.java`
- Test: `backend-java/src/test/java/com/digitalhuman/backend_java/service/VoiceScriptSceneServiceTests.java`

**Interfaces:**
- Produces: `rollback(Long id)`, `synthesize(Long id, VoiceScriptSynthesizeRequest request)`, `listPublished(String spotId)`。

- [ ] 写失败测试：发布缺少音频时返回 400，文本变化后音频变为 `stale`，回滚产生下一版本。
- [ ] 运行 `mvn -Dtest=VoiceScriptSceneServiceTests test`，确认测试因接口缺失或行为不符而失败。
- [ ] 增加音频和来源字段、版本查询方法、摘要校验、回滚和 TTS 合成保存逻辑。
- [ ] 再次运行目标测试并确认通过。

### Task 2: 多知识库 AI 生成编排

**Files:**
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VoiceScriptGenerateRequest.java`
- Create: `backend-java/src/main/java/com/digitalhuman/backend_java/service/VoiceScriptGenerationService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminVoiceScriptController.java`
- Test: `backend-java/src/test/java/com/digitalhuman/backend_java/service/VoiceScriptGenerationServiceTests.java`

**Interfaces:**
- Consumes: `MaxKbKnowledgeService.hitTest(Long, Map<String,Object>)`、`ScenicStructuredSpotRecordRepository.findBySpot_idIgnoreCase`。
- Produces: `VoiceScriptScene generate(VoiceScriptGenerateRequest request)`。

- [ ] 写失败测试：多个知识库逐个检索、所选文档过滤、目标时长提示、下一版本保存、无有效来源拒绝生成。
- [ ] 运行目标测试并确认红灯。
- [ ] 实现检索上下文、来源 JSON 快照、AI basic-chat 调用和草稿落库；AI 返回为空时不保存。
- [ ] 运行目标测试并确认绿灯。

### Task 3: 景点绑定与直播配置校验

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/model/ScenicStructuredSpotRecord.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/ScenicStructuredSpotRecordRequest.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicStructuredSpotService.java`
- Test: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicStructuredSpotServiceTests.java`

**Interfaces:**
- Consumes: `VoiceScriptSceneRepository.findById`。
- Produces: 景点记录中的 `audio_enabled`、`live_enabled`、`default_experience`、`bound_voice_script_id` 和直播源字段。

- [ ] 写失败测试：语音启用但未绑定、绑定未发布/无音频、直播无来源、默认入口无效均拒绝保存。
- [ ] 运行目标测试并确认红灯。
- [ ] 扩展模型、请求和服务校验，保留 DOCX 导入时游客呈现配置默认关闭。
- [ ] 运行目标测试并确认绿灯。

### Task 4: 管理端口播生产工作台

**Files:**
- Modify: `frontend-admin/src/api/voiceScripts.ts`
- Modify: `frontend-admin/src/pages/scenic/VoiceScriptPage.tsx`
- Test: `frontend-admin/src/pages/scenic/VoiceScriptPage.test.mjs`

**Interfaces:**
- Consumes: 知识库账号/知识库/文档 API、口播生成/回滚/合成/发布 API。
- Produces: AI 生成抽屉、手工新增、来源查看、音频状态、试听和历史版本操作。

- [ ] 先扩展契约测试，断言多知识库与多文档选择、30/60/90/120/自定义时长、手工新增、合成试听和发布门禁。
- [ ] 运行 `node src/pages/scenic/VoiceScriptPage.test.mjs` 并确认失败。
- [ ] 扩展 API 类型与页面交互；知识库列表按账号加载，文档按知识库懒加载。
- [ ] 运行目标测试并确认通过。

### Task 5: 管理端景点绑定

**Files:**
- Modify: `frontend-admin/src/api/scenicStructured.ts`
- Modify: `frontend-admin/src/pages/scenic/ScenicStructuredPage.tsx`
- Test: `frontend-admin/src/pages/scenic/ScenicStructuredPage.test.mjs`

**Interfaces:**
- Consumes: `GET /api/admin/voice-scripts/published?spotId=...`。
- Produces: 语音/直播开关、已发布口播选择、默认入口、视频/流/摄像头通道配置。

- [ ] 写失败契约测试，覆盖语音绑定、直播来源条件字段和默认入口。
- [ ] 运行目标测试并确认失败。
- [ ] 实现游客呈现配置区域与前端校验；摄像头按钮只做权限检测并要求推流通道。
- [ ] 运行目标测试并确认通过。

### Task 6: 全量验证

**Files:**
- Verify only.

- [ ] 运行 `mvn test`，预期 0 failures、0 errors。
- [ ] 在 `frontend-admin` 运行口播和景点契约测试。
- [ ] 运行 `npm run lint`，预期 0 errors。
- [ ] 运行 `npm run build`，预期退出码 0。
- [ ] 对照设计规格逐项检查生成、手工稿、版本、语音、发布和绑定规则。
