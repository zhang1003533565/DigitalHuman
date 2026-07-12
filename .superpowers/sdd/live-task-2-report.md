# Task 2 交付报告

## 结果

- 实现直播草稿的查询、新建、更新、删除与全量重排。
- 实现事务发布：只读取启用草稿，按 `sortOrder,id` 排序，校验字段后创建不可变版本和条目快照。
- 实现最新发布摘要与游客统一直播状态；状态计算使用注入的 `Clock` 和 `LiveTimelineResolver`，不创建游客会话。
- 实现管理端与游客端固定 REST 接口；管理直播接口严格限制 `ADMIN`，游客状态要求 `USER` 登录。
- 游客快照 DTO 不暴露草稿字段 `enabled`、`updatedAt`。

## TDD 证据

- RED：`./mvnw -Dtest=LiveBroadcastServiceTests,LiveBroadcastControllerTests test` 因 Task 2 类型缺失而按预期编译失败。
- GREEN：`./mvnw -Dtest=LiveTimelineResolverTests,LiveBroadcastServiceTests,LiveBroadcastControllerTests test`：17 项通过。
- 回归：`./mvnw test`：64 项通过，0 失败、0 错误、0 跳过。

## 自审

- 发布方法标注 `@Transactional`，版本与快照在同一事务写入。
- 发布内容由值复制构成，后续草稿变更不会改变已发布快照。
- 最新版本沿用 Task 1 的 `publishedAt desc,id desc` 查询；快照沿用 `versionId,sortOrder,id` 查询。
- `Clock` 与时间轴解析器均为 Spring Bean，可在测试中替换为固定时钟。

## 关注点

- 当前重排请求体为完整 ID 数组；缺失、重复或未知 ID 返回 400/404。
- 数据库结构继续由现有 JPA DDL 策略管理，本任务未新增迁移脚本。
