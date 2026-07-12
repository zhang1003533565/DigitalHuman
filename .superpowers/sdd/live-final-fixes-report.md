# 直播最终修复报告

日期：2026-07-13

## 完成项

- 游客直播页在页面可见时每 30 秒拉取一次直播状态；从后台恢复可见时立即同步。轮询、初始定时器、状态请求、互动请求、语音请求和语音识别均在卸载时清理或中止。
- 状态同步不再与直播语音共用 `AbortController`，轮询不会主动打断当前语音。只有确认新版本后才切换时间轴并停止旧音频。
- 已有有效快照时，同步失败继续使用旧快照计算当前时间轴，恢复 `broadcasting` 和当前条目语音，并显示非阻断同步错误。首次同步失败进入 `error`，显示“重新连接”按钮。
- 问答完成使用新语音 generation 回到服务端校准后的当前条目，不回退到提问前的条目。
- 新增后端 `VisitorLiveItemDto(itemId,title,content,durationMs,sortOrder)`；游客状态不再复用含管理字段的 DTO，前端直接消费 `itemId`，删除私有 `id -> itemId` 转换。
- 单条直播 TTS 失败显示非阻断提示并记录包含 `versionId`、`itemId` 的诊断日志；失败不会阻断后续条目的语音尝试。

## 测试覆盖

- `LiveBroadcastPage.test.mjs`：30 秒可见轮询、visibility 立即同步、interval/request cleanup、版本切换、旧快照失败回退、首次重试按钮、TTS 失败提示和日志、前端 `itemId` 原始契约。
- `LiveBroadcastControllerTests`：游客条目输出 `itemId` 且不输出 `id`、管理字段。
- `LiveBroadcastServiceTests`：发布快照的 source item ID 映射到游客 DTO `itemId`。

## 验证结果

- 后端：`./mvnw test`，68 tests，0 failures，0 errors，0 skipped。
- 游客端：13 个 `*.test.mjs` 文件全部通过；`npm run lint` 通过；`npm run build` 通过。
- 管理端 sanity：`admin-upgrade.test.mjs`、`npm run lint`、`npm run build` 通过。
- Diff：`git diff --check` 通过。

## 已知缺口

- 按用户要求未运行浏览器或真实音频设备端到端验证。
- 直播页测试为源码契约与纯时间轴单元测试；未引入 DOM 测试依赖。

## 最终复审追加修复

- `poll` 与 `visibility-resume` 在提问/回答请求或 `answer-complete` 恢复同步进行中直接跳过，不会应用快照、切换 phase、停止回答音频或解除发送门禁。
- 普通后台同步失败在已有直播快照时只更新 `syncError`；不修改 position、spoken item key、speech generation 或当前音频。只有 `answer-complete` 失败会按旧快照的当前全局位置恢复并重新播放。
- 直播 TTS 错误改用独立 `broadcastSpeechError`，直播条目播放不会再清除 `interactionError`；问答/SSE/回答 TTS 失败在恢复直播后仍可见。
- 新增可执行同步策略测试，模拟互动期间后台同步、恢复同步竞争、普通后台失败和回答恢复失败，另以页面契约锁定独立错误状态。

追加验证：游客端全部 13 个 `*.test.mjs` 文件、ESLint、Vite build 通过；后端 `LiveBroadcastControllerTests` 与 `LiveBroadcastServiceTests` 通过。

## 最终竞态修复

- 提问开始时仅取消在途的 `poll` / `visibility-resume` 请求并推进同步序号；不会误取消 `answer-complete` 恢复同步。
- 后台同步成功响应在 `applySnapshot` 前、失败响应在设置错误或 fallback 前再次仲裁；若请求发出后互动已经开始，响应和错误均直接丢弃，不改变 phase、position、spoken key、回答音频或错误状态。
- 可执行顺序测试覆盖 `poll-start → ask-start → poll-resolve` 与 `poll-start → ask-start → poll-reject`，断言均不 apply、不切换 broadcasting/error、不停止回答播放。
