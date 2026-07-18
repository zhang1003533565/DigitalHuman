# 景点直播语音与弹幕体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让景点直播持续循环背景视频和已发布讲解音频，以讲解与 AI 回答驱动数字人口型，并提供桌面、移动端一致的直播弹幕发送体验。

**Architecture:** 后端继续以 `VoiceScriptScene` 作为唯一口播和音频来源，景点配置接口返回该景点全部可维护版本，游客直播配置只暴露当前绑定的已发布音频。管理端复用现有合成与发布接口完成快捷工作流；游客端用一个本地有界消息模型和单一音频调度器协调循环讲解、问答打断、主播回答和恢复播放，视频轨道完全独立。

**Tech Stack:** Spring Boot 3、Spring Data JPA、JUnit 5/Mockito、React 19、TypeScript、Ant Design、Vite、Live2D/PixiJS、原生 HTMLMediaElement。

## Global Constraints

- 复用现有口播版本、音频哈希、发布和回滚规则，不新增口播或音频数据表。
- 背景视频静音、自动播放、循环，并且不得被问答或讲解音频状态暂停。
- 基础讲解循环间隔固定为 2 秒；被问答打断后从头恢复。
- 游客消息和 AI 主播回答进入同一消息流，当前会话最多保留最近 100 条。
- 不增加礼物、点赞、在线人数、多人 WebSocket 聊天或第三方平台品牌元素。
- 不增加前端依赖；使用项目现有图标库和媒体能力。
- 保留工作区中与本任务无关的修改，提交时只暂存当前任务文件。

---

### Task 1: 返回景点全部可维护口播版本

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/repository/VoiceScriptSceneRepository.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/controller/AdminScenicController.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`
- Modify: `frontend-admin/src/api/scenic.ts`

**Interfaces:**
- Produces: `ScenicFacilityContentService.listVoiceScriptsForManagement(Long facilityId): List<VoiceScriptScene>`，返回直接 `facilityId` 关联及兼容旧 `spotId` 关联的全部版本，按更新时间和 ID 倒序且 ID 去重。
- Produces: 现有 `GET /api/admin/scenic/facilities/{id}/voice-scripts` 改为返回上述管理列表。
- Consumes: `VoiceScriptSceneRepository.findByFacilityIdOrderByUpdatedAtDescIdDesc` 与 `findBySpotIdOrderByUpdatedAtDescIdDesc`。

- [ ] **Step 1: 写失败的服务测试**

在 `ScenicFacilityContentServiceTests` 增加草稿、已发布、过期音频和旧 `spotId` 数据，断言接口全部返回并按 ID 去重：

```java
@Test
void listsAllFacilityVoiceScriptVersionsForManagement() {
    VoiceScriptScene draft = voice(61L, 12L, "LS-001", "draft", "missing");
    VoiceScriptScene published = voice(62L, 12L, "LS-001", "published", "ready");
    VoiceScriptScene legacy = voice(63L, null, "LS-001", "archived", "stale");
    when(fixtures.voiceRepository.findByFacilityIdOrderByUpdatedAtDescIdDesc(12L))
            .thenReturn(List.of(published, draft));
    when(fixtures.voiceRepository.findBySpotIdOrderByUpdatedAtDescIdDesc("LS-001"))
            .thenReturn(List.of(published, legacy));

    assertEquals(
            List.of(62L, 61L, 63L),
            fixtures.service.listVoiceScriptsForManagement(12L).stream().map(VoiceScriptScene::getId).toList());
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`

Expected: FAIL，提示管理列表方法或仓库查询方法不存在。

- [ ] **Step 3: 实现仓库查询和服务去重**

仓库增加：

```java
List<VoiceScriptScene> findByFacilityIdOrderByUpdatedAtDescIdDesc(Long facilityId);
List<VoiceScriptScene> findBySpotIdOrderByUpdatedAtDescIdDesc(String spotId);
```

服务使用 `LinkedHashMap<Long, VoiceScriptScene>` 先加入直接关联，再加入旧 `spotId` 关联，并让控制器现有路由调用新方法。保留 `listBindableVoiceScripts` 供保存校验或其他调用者使用。

- [ ] **Step 4: 运行测试并确认通过**

Run: `cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`

Expected: PASS。

- [ ] **Step 5: 更新管理端候选类型并提交**

为 `ScenicFacilityVoiceScript` 增加管理工作流需要的字段：

```typescript
status: 'draft' | 'published' | 'archived'
audioStatus?: 'missing' | 'ready' | 'stale' | 'failed'
voiceId?: string
speechRate?: string
speechVolume?: string
speechPitch?: string
```

提交时仅暂存本任务后端文件与 API 类型文件。

---

### Task 2: 在游客直播配置中公开绑定讲解音频

**Files:**
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/dto/VisitorFacilityLiveConfigDto.java`
- Modify: `backend-java/src/main/java/com/digitalhuman/backend_java/service/ScenicFacilityContentService.java`
- Modify: `backend-java/src/test/java/com/digitalhuman/backend_java/service/ScenicFacilityContentServiceTests.java`
- Modify: `frontend-visitor/src/api/liveBroadcast.ts`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

**Interfaces:**
- Produces: `VisitorFacilityLiveConfigDto.Narration(Long scriptId, String title, String audioUrl, Integer durationSec, Integer versionNo)`。
- Produces: `FacilityLiveConfig.narration?: FacilityLiveNarration | null`。
- Consumes: `ScenicFacilityPresentation.audioEnabled` 与 `boundVoiceScriptId`。

- [ ] **Step 1: 写失败的后端公开契约测试**

增加两项测试：有效绑定返回 narration；草稿、过期音频或未启用语音时 narration 为 null。

```java
@Test
void exposesPublishedBoundNarrationInVisitorLiveConfig() {
    Fixtures fixtures = fixtures();
    DigitalHumanModel model = new DigitalHumanModel();
    model.setStatus("active");
    ScenicFacilityPresentation presentation = new ScenicFacilityPresentation();
    presentation.setLiveEnabled(true);
    presentation.setLiveSourceType("video");
    presentation.setLiveVideoUrl("/api/scenic-media/live.mp4");
    presentation.setLiveDigitalHumanModel(model);
    VoiceScriptScene narration = voice(71L, 12L, "LS-001", "published", "ready");
    narration.setTitle("灵山胜境讲解");
    narration.setAudioUrl("/api/tts/audio/voice-71.mp3");
    narration.setDurationSec(64);
    narration.setVersionNo(3);
    presentation.setAudioEnabled(true);
    presentation.setBoundVoiceScriptId(71L);
    when(fixtures.presentationRepository.findByFacilityId(12L)).thenReturn(Optional.of(presentation));
    when(fixtures.voiceRepository.findById(71L)).thenReturn(Optional.of(narration));

    VisitorFacilityLiveConfigDto result = fixtures.service.getVisitorLiveConfig(12L);

    assertEquals("/api/tts/audio/voice-71.mp3", result.narration().audioUrl());
    assertEquals(3, result.narration().versionNo());
}
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test`

Expected: FAIL，`narration()` 不存在。

- [ ] **Step 3: 实现公开 narration 映射**

新增嵌套 record，并在 `getVisitorLiveConfig` 中通过私有方法解析：

```java
private VisitorFacilityLiveConfigDto.Narration resolveNarration(ScenicFacilityPresentation presentation) {
    if (presentation == null || !Boolean.TRUE.equals(presentation.getAudioEnabled())
            || presentation.getBoundVoiceScriptId() == null) return null;
    return voiceScriptRepository.findById(presentation.getBoundVoiceScriptId())
            .filter(this::isPublishedReadyAudio)
            .map(script -> new VisitorFacilityLiveConfigDto.Narration(
                    script.getId(), script.getTitle(), script.getAudioUrl(),
                    script.getDurationSec(), script.getVersionNo()))
            .orElse(null);
}
```

`unavailableLiveConfig` 也返回 narration null，且绝不公开文件系统路径、SSML 或合成参数。

- [ ] **Step 4: 更新 TypeScript 类型和静态 API 契约并运行双端测试**

```typescript
export type FacilityLiveNarration = {
  scriptId: number
  title: string
  audioUrl: string
  durationSec: number
  versionNo: number
}
```

在 `LiveBroadcastPage.test.mjs` 增加 `assert.match(liveApi, /export type FacilityLiveNarration/)` 和 `assert.match(liveApi, /narration\?: FacilityLiveNarration \| null/)`，只验证本任务产生的公开类型。

Run:

```bash
cd backend-java && mvn -q -Dtest=ScenicFacilityContentServiceTests test
cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs
```

Expected: 两项均 PASS。

- [ ] **Step 5: 提交公开配置契约**

只暂存本任务 DTO、服务测试、游客 API 类型和契约测试。

---

### Task 3: 在景点配置中完成合成、试听、发布和绑定

**Files:**
- Create: `frontend-admin/src/pages/scenic/voiceSynthesisOptions.ts`
- Modify: `frontend-admin/src/pages/scenic/VoiceScriptPage.tsx`
- Modify: `frontend-admin/src/pages/scenic/components/FacilityContentDrawer.tsx`
- Modify: `frontend-admin/src/pages/scenic/FacilityContentPage.test.mjs`
- Modify: `frontend-admin/src/api/voiceScripts.ts`

**Interfaces:**
- Produces: `voiceOptions`、`speechRateOptions`、`speechVolumeOptions`、`speechPitchOptions` 共享常量。
- Consumes: `synthesizeVoiceScriptRecord(id, payload)`、`publishVoiceScriptRecord(id)`、`saveScenicFacilityContent(facilityId, values)`。

- [ ] **Step 1: 完善失败的管理端契约测试**

断言页面存在：

```javascript
assert.match(drawer, /synthesizeVoiceScriptRecord/)
assert.match(drawer, /publishVoiceScriptRecord/)
assert.match(drawer, /合成试听/)
assert.match(drawer, /发布并绑定/)
assert.match(drawer, /audio controls/)
assert.match(drawer, /audioStatus/)
assert.match(drawer, /speechRate/)
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend-admin && node src/pages/scenic/FacilityContentPage.test.mjs`

Expected: FAIL，快捷合成控件不存在。

- [ ] **Step 3: 抽取合成选项并复用**

把 `VoiceScriptPage.tsx` 中四组配置移到 `voiceSynthesisOptions.ts` 并导出；两个页面使用同一组选项与默认值，避免音色名称和参数漂移。

- [ ] **Step 4: 实现快捷合成状态**

在抽屉中增加：

```typescript
const selectedScriptId = Form.useWatch('boundVoiceScriptId', form)
const selectedScript = scripts.find((script) => script.id === selectedScriptId) ?? null
```

选择器标签展示 `标题 · v版本 · 草稿/已发布 · 未合成/可试听/需重合成`。选择草稿后可配置四项合成参数；点击“合成试听”调用现有合成接口，替换本地候选记录并显示 `<audio controls>`。已发布版本禁用重新合成并提示先回滚。

- [ ] **Step 5: 实现发布并绑定**

按钮只在草稿且 `audioStatus === 'ready'` 时启用。点击后顺序执行：发布口播、更新候选列表、设置 `boundVoiceScriptId`、校验当前表单、调用 `saveScenicFacilityContent` 持久化绑定；任一步失败时显示具体错误，不能伪装为已绑定。

- [ ] **Step 6: 运行管理端测试、lint 和构建**

```bash
cd frontend-admin
node src/pages/scenic/FacilityContentPage.test.mjs
npm run lint
npm run build
```

Expected: 全部 PASS；仅允许既有的大 chunk 警告。

- [ ] **Step 7: 提交后台快捷工作流**

只暂存共享选项、两个页面、API 和测试文件。

---

### Task 4: 建立有界直播消息模型和语音调度器

**Files:**
- Create: `frontend-visitor/src/live/liveChat.ts`
- Create: `frontend-visitor/src/live/liveChat.test.mjs`
- Create: `frontend-visitor/src/live/facilityNarrationController.ts`
- Create: `frontend-visitor/src/live/facilityNarrationController.test.mjs`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.tsx`

**Interfaces:**
- Produces: `LiveChatMessage`，角色为 `viewer | host | system`，状态为 `sending | streaming | sent | failed`。
- Produces: `appendLiveMessage(messages, message, limit = 100)` 与 `updateLiveMessage(messages, id, patch)`。
- Produces: `createNarrationController({ speakAudio, stopAudio, delayMs: 2000 })`，公开 `start(url)`、`interrupt()`、`resume()`、`destroy()`。

- [ ] **Step 1: 写失败的消息模型测试**

测试第 101 条消息会移除最旧消息，流式主播消息按 ID 原位更新，失败游客消息保留：

```javascript
assert.equal(appendLiveMessage(existing100, next).length, 100)
assert.equal(appendLiveMessage(existing100, next)[99].id, next.id)
assert.equal(updateLiveMessage(messages, 'host-1', { content: '完整回答' })[0].content, '完整回答')
```

- [ ] **Step 2: 运行并确认消息测试失败**

Run: `cd frontend-visitor && node src/live/liveChat.test.mjs`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯消息函数并确认通过**

函数不得修改输入数组，未找到 ID 时原样返回；运行相同命令应 PASS。

- [ ] **Step 4: 写失败的语音调度测试**

使用可控 Promise 和假计时回调验证：首次 start 会播放；自然结束后 2 秒循环；interrupt 取消循环；resume 从头播放；destroy 后任何完成回调都不能重启。

- [ ] **Step 5: 实现调度器并确认通过**

调度器以 generation 数字淘汰旧回调，不自行创建 `Audio`，只协调传入的 `speakAudio(url): Promise<void>` 和 `stopAudio()`，从而继续复用 Live2D `speak`。

- [ ] **Step 6: 写失败的页面播放集成契约测试**

在 `LiveBroadcastPage.test.mjs` 断言页面消费 `liveConfig.narration.audioUrl`、创建 narration controller、提问时调用 `interrupt()`、回答结束调用 `resume()`，并通过消息更新函数追加 viewer 与 host 消息。

Run: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs`

Expected: FAIL，页面尚未接入 narration 和新消息模型。

- [ ] **Step 7: 将页面问答接入消息与调度器**

发送时乐观加入 viewer 消息和空 host 消息；每个 SSE token 更新同一 host 消息。提问前 `interrupt()`，回答文本完成后使用现有 TTS 请求和 `speak` 驱动口型，回答结束或失败后 `resume()`。配置 narration 和模型就绪后调用 `start(audioUrl)`。

- [ ] **Step 8: 删除冲突的全局时间轴播放逻辑**

`LiveBroadcastPage` 不再轮询 `/api/user/live/status`、不再使用 `LivePosition`，避免全局时间轴 TTS 与景点绑定音频同时发声。保留当前问答 SSE 会话 ID 和取消请求能力。

- [ ] **Step 9: 运行纯函数和页面契约测试**

```bash
cd frontend-visitor
node src/live/liveChat.test.mjs
node src/live/facilityNarrationController.test.mjs
node src/pages/LiveBroadcastPage.test.mjs
```

Expected: 全部 PASS。

- [ ] **Step 10: 提交消息与播放状态机**

只暂存本任务新模块、测试和页面逻辑。

---

### Task 5: 重构为桌面与移动端直播弹幕布局

**Files:**
- Create: `frontend-visitor/src/pages/components/LiveChatFeed.tsx`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.tsx`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.css`
- Modify: `frontend-visitor/src/pages/LiveBroadcastPage.test.mjs`

**Interfaces:**
- Consumes: `LiveChatMessage[]`、`draft`、`busy`、`onDraftChange`、`onSend`、`onRetry`。
- Produces: `LiveChatFeed`，桌面和移动共享消息 DOM，CSS 决定右侧栏或舞台叠加位置。

- [ ] **Step 1: 写失败的响应式布局契约测试**

断言：

```javascript
assert.match(page, /<LiveChatFeed/)
assert.match(page, /type="text"/)
assert.match(page, /aria-label="发送弹幕"/)
assert.doesNotMatch(page, /<textarea/)
assert.doesNotMatch(page, /语音提问|停止本地回答/)
assert.match(css, /\.live-chat__feed/)
assert.match(css, /@media\s*\(max-width:\s*768px\)[\s\S]*position:\s*absolute/)
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd frontend-visitor && node src/pages/LiveBroadcastPage.test.mjs`

Expected: FAIL，仍存在大文本域和旧操作按钮。

- [ ] **Step 3: 实现共享消息组件**

组件为每条消息显示昵称、内容和状态；主播消息带“主播”标识，失败消息提供重试按钮。新消息到达时仅在用户接近底部时自动滚动，用户向上阅读时不得强制跳回底部。

- [ ] **Step 4: 实现桌面布局**

使用稳定两列网格：舞台 `minmax(0, 1fr)`，聊天栏 `360px`。聊天栏包含主播信息、消息区、底部单行输入和纸飞机图标按钮。Enter 发送，发送中禁用重复提交但保留文字。

- [ ] **Step 5: 实现移动布局**

在 `max-width: 768px` 下让舞台占据可用视口；消息层绝对定位在左下并为底部输入栏预留空间；输入栏固定在舞台底部并使用 `env(safe-area-inset-bottom)`。消息最大宽度限制为舞台的 78%，避免遮挡数字人脸部和顶部主播信息。

- [ ] **Step 6: 增加自动播放解锁状态**

若基础讲解 `Audio.play()` 被浏览器拒绝，在消息层显示 system 消息并提供“开启讲解”按钮；用户点击后重新 `start(audioUrl)`，不影响视频播放。

- [ ] **Step 7: 运行游客端测试、lint 和构建**

```bash
cd frontend-visitor
node src/live/liveChat.test.mjs
node src/live/facilityNarrationController.test.mjs
node src/pages/LiveBroadcastPage.test.mjs
npm run lint
npm run build
```

Expected: 全部 PASS；无新增警告。

- [ ] **Step 8: 提交响应式直播体验**

只暂存消息组件、直播页、CSS 和测试。

---

### Task 6: 完整回归与真实浏览器验收

**Files:**
- Modify only if verification exposes a defect in files owned by Tasks 1-5.

**Interfaces:**
- Consumes: 后台景点内容配置、游客直播配置、媒体接口、TTS 音频和直播页。
- Produces: 可复现的测试与浏览器验收证据。

- [ ] **Step 1: 运行完整自动化验证**

```bash
cd backend-java && mvn -q test
cd ../frontend-admin && npm run lint && npm run build
cd ../frontend-visitor && npm run lint && npm run build
node src/live/liveChat.test.mjs
node src/live/facilityNarrationController.test.mjs
node src/pages/LiveBroadcastPage.test.mjs
```

Expected: 全部退出码为 0。

- [ ] **Step 2: 验证后台真实工作流**

在 `http://localhost:5241/admin/spots/facilities` 打开灵山胜境内容配置，确认能看到草稿和发布版本；选择音色并合成；音频播放器 `readyState >= 2`；发布并绑定后重新打开抽屉仍显示同一绑定 ID。

- [ ] **Step 3: 验证游客公开配置**

读取 `/api/user/live/config?facilityId=1`，确认 `narration.audioUrl` 存在且不包含 SSML、文件系统路径或摄像头推流密钥。

- [ ] **Step 4: 验证真实媒体与口型播放**

在 Chrome 检查视频元素 `readyState === 4`、`paused === false`、`loop === true`；确认讲解音频播放时 Live2D 嘴部参数持续变化。发送问题后视频 `currentTime` 继续增长，基础讲解停止，主播回答语音播放，结束后 2 秒内基础讲解重新开始。

- [ ] **Step 5: 验证桌面与移动截图**

桌面使用 1440×900，移动使用 390×844。检查无重叠、无横向滚动、输入文字完整、软键盘前后输入栏可见、消息不遮挡数字人面部，并保存截图作为本次验证证据。

- [ ] **Step 6: 最终差异检查和提交**

Run: `git diff --check`

Expected: 无输出。仅暂存本计划涉及文件，提交信息记录完整测试与未测试项。
