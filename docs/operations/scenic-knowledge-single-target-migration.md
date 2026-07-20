# 景点知识单目标发布迁移手册

## 适用范围

用于把 `scenic_knowledge_publication` 的发布预留槽从“景点 + MaxKB 目标”收紧为“景点全局唯一”。迁移文件：

`backend-java/src/main/resources/db/migration/manual/2026-07-20-scenic-knowledge-single-target.sql`

迁移必须在停止 DigitalHuman 后端写入的维护窗口执行，并先完成数据库备份。不要只依赖 Hibernate `ddl-auto:update`；同名索引的列变化不会被可靠更新。

## 正常执行

1. 停止所有可能发布、重发或撤回景点知识的 DigitalHuman 实例。
2. 备份 `scenic_knowledge_publication`。
3. 使用目标环境的数据库变更账号执行迁移 SQL。
4. 两个预检查询都应返回零行；若 guard 报 `Duplicate entry`，不得继续索引变更，转到“冲突对账”。
5. 完成后从 `information_schema.STATISTICS` 确认索引列顺序为 `facility_id,publish_slot`。
6. 启动一个后端实例并验证景点知识状态读取，再恢复全部实例。

## 冲突对账

预检会列出两类冲突：同一景点已有多个 `published/outdated` 远端文档，或同一景点存在多个非空 `publish_slot`。

对每个冲突景点执行：

1. 按 `updated_at DESC, id DESC` 选出默认保留行，并由业务管理员确认账号、知识库和文档目标正确。
2. 对其他带 `document_id` 的行，使用该行对应 `account_id` 的 MaxKB 凭据调用精确文档删除接口；必须匹配该行自己的 `knowledge_id` 和 `document_id`。认证信息不得写入命令历史、工单或日志。
3. 只有远端删除成功后，才把对应本地行更新为 `withdrawn`，清空 `publish_slot`，并在 `last_error` 中记录不含凭据的迁移说明。
4. 对没有 `document_id` 的遗留 `publishing` 行，先确认不存在仍在执行的远端任务；确认后改为 `failed` 并清空 `publish_slot`。无法确认时保持停写并升级处理，不得猜测删除。
5. 重新执行迁移 SQL中的两个预检查询，直至均返回零行，再从头执行完整迁移。

示例本地状态修正必须替换为已人工确认的精确行 ID，并且只能在相应远端删除成功后执行：

```sql
UPDATE scenic_knowledge_publication
SET status = 'withdrawn',
    publish_slot = NULL,
    last_error = 'single-target migration: duplicate remote document reconciled'
WHERE id IN (/* 已完成远端删除的精确行 ID */);
```

## 回滚索引

若应用发布前需要回退索引，可在停写窗口执行：

```sql
ALTER TABLE scenic_knowledge_publication
    DROP INDEX uk_scenic_knowledge_publication_active_slot,
    ADD UNIQUE INDEX uk_scenic_knowledge_publication_active_slot
        (facility_id, account_id, knowledge_id, publish_slot);
```

索引回滚不会恢复已经按本手册删除的远端文档；远端恢复必须通过管理员重新发布正式景点资料完成。
