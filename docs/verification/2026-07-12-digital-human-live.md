# 数字人持续直播交付验证（2026-07-12）

## 结论

数字人持续直播的后端相关回归、管理端门禁、游客端完整 Node 测试、Lint 与生产构建均通过。权限与持续直播语义已通过自动化测试和源码复核锁定；按任务要求未打开浏览器，因此桌面/移动端真实视觉与真实语音识别设备行为仍属于披露的人工验证缺口。

## 执行环境

- 日期：2026-07-12
- 工作区：`DigitalHuman`
- Java：测试输出显示 Java 21.0.11，项目编译目标 Java 17
- 前端构建：Vite 8.0.13
- 浏览器：未打开（用户明确要求）

## 自动化验证

### 后端相关测试

```bash
cd backend-java
./mvnw test
```

结果：退出码 0；68 项测试，0 failures，0 errors，0 skipped。

覆盖包括：

- 服务器统一时间轴、循环边界和当前条目偏移。
- 游客状态未发布/已发布响应及草稿字段隔离。
- ADMIN 正向读取直播草稿；OBSERVER 和 USER 均被管理员直播接口拒绝。
- H2 上真实 JPA 发布版本与快照条目插入、排序及独立事务异常回滚。
- 个人问答服务与流式控制器相关回归。

### 管理端

```bash
cd frontend-admin
node src/pages/admin-upgrade.test.mjs && npm run lint && npm run build
```

结果：退出码 0；1 个结构/安全契约脚本通过；ESLint 通过；TypeScript 与 Vite production build 通过。构建仅报告既有大 chunk 警告，不影响退出码。

### 游客端

```bash
cd frontend-visitor
for test_file in $(find src -name '*.test.mjs' -print | sort); do node "$test_file" || exit 1; done && npm run lint && npm run build
```

结果：退出码 0；13 个 Node 测试脚本全部通过（其中 HomePage 使用 `node:test`，2 个 subtests 通过）；ESLint 通过；TypeScript 与 Vite production build 通过。

覆盖包括：

- 地图主按钮进入受保护 `/live` 路由。
- 地图直播状态请求使用 generation guard，过期响应不会覆盖新状态。
- 问答完成和停止本地回答只重新同步服务器直播进度。
- 可见页面每 30 秒同步发布版本；首次失败提供重试，后台同步失败保留旧时间轴与当前语音。
- 提问开始后，迟到的后台同步成功或失败响应均被请求代际和互动状态仲裁丢弃，不会切换 phase 或中断个人回答。
- 游客状态使用独立 `VisitorLiveItemDto`，原生返回 `itemId`，不复用管理端草稿 DTO。
- SpeechRecognition 不可用、异步错误与 `start()` 同步异常均有可见错误路径。
- 页面与子元素统一 `box-sizing: border-box`，移动布局、触摸手势和底栏安全区契约通过。

## 安全与持续直播语义复核

- 游客接口只读取最新 `LiveBroadcastVersion` 与 `LiveBroadcastVersionItem`；未发布响应不包含版本或草稿，已发布条目的 `enabled`、`updatedAt` 等草稿字段不存在。
- `/api/admin/live-broadcast` 由服务端拦截器限定 ADMIN；OBSERVER 与 USER 拒绝路径有控制器测试。管理端 OBSERVER 直达 `/admin/live-broadcast` 时显示友好无权页面，不挂载直播管理组件。
- 游客进入、退出、隐藏/恢复页面只读取状态或清理本地播放资源，不创建、不更新直播版本。
- 个人问答结束只调用 `syncLiveStatus('answer-complete')`；“停止本地回答”只停止本地播放并重新同步，不影响其他游客。
- 后端直播控制器不存在全局暂停/停止接口；管理员写接口仅包含草稿维护、排序和发布。
- 发布通过复制标量字段创建不可变快照实体；游客读取快照仓库，不引用可变草稿实体。JPA 插入与回滚测试提供数据库级证据。

## 边界与缺口

- 已验证发布时间前、循环切换、精确边界、极大时间间隔、版本切换、失败恢复、过期请求和事务回滚等自动化边界。
- 按用户要求未打开浏览器，因此未执行真实桌面/移动 viewport 截图、触控手势、Live2D/WebAudio、浏览器 SpeechRecognition 权限与设备兼容性验证。
- JPA 集成测试使用 H2；未对生产 MySQL 实例执行迁移或发布事务验证。
- 管理端构建保留 Vite 大 chunk 警告，属于性能优化项，不是本次持续直播正确性阻断项。
