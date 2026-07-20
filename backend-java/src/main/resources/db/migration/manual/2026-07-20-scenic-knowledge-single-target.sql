-- 同一正式景点只允许一个发布任务占用活动槽，切换 MaxKB 目标时由服务安全替换旧文档。
-- 在维护窗口停写后执行。若下方 guard 报 Duplicate entry，请停止迁移并按
-- docs/operations/scenic-knowledge-single-target-migration.md 清理远端与本地双活记录后重试。

-- 输出已存在的远端双活，供执行人保存到变更记录。查询有结果时 guard 会强制中止。
SELECT
    facility_id,
    COUNT(*) AS active_document_count,
    GROUP_CONCAT(
        CONCAT('row=', id, ',account=', account_id, ',knowledge=', knowledge_id, ',document=', document_id)
        ORDER BY updated_at DESC, id DESC
        SEPARATOR '; '
    ) AS active_documents
FROM scenic_knowledge_publication
WHERE status IN ('published', 'outdated')
  AND document_id IS NOT NULL
  AND document_id <> ''
GROUP BY facility_id
HAVING COUNT(*) > 1;

-- 输出旧约束曾允许的跨目标并行发布槽。
SELECT
    facility_id,
    publish_slot,
    COUNT(*) AS reserved_slot_count,
    GROUP_CONCAT(id ORDER BY updated_at DESC, id DESC) AS publication_rows
FROM scenic_knowledge_publication
WHERE publish_slot IS NOT NULL
GROUP BY facility_id, publish_slot
HAVING COUNT(*) > 1;

-- MySQL 无通用 ASSERT 语句；向单行主键表二次插入可在任一冲突存在时可靠失败并阻止 DDL。
CREATE TEMPORARY TABLE scenic_knowledge_single_target_guard (
    guard_key TINYINT NOT NULL PRIMARY KEY
);

INSERT INTO scenic_knowledge_single_target_guard (guard_key) VALUES (1);

INSERT INTO scenic_knowledge_single_target_guard (guard_key)
SELECT 1
FROM (
    SELECT facility_id
    FROM scenic_knowledge_publication
    WHERE status IN ('published', 'outdated')
      AND document_id IS NOT NULL
      AND document_id <> ''
    GROUP BY facility_id
    HAVING COUNT(*) > 1

    UNION ALL

    SELECT facility_id
    FROM scenic_knowledge_publication
    WHERE publish_slot IS NOT NULL
    GROUP BY facility_id, publish_slot
    HAVING COUNT(*) > 1
) AS legacy_conflicts
LIMIT 1;

DROP TEMPORARY TABLE scenic_knowledge_single_target_guard;

ALTER TABLE scenic_knowledge_publication
    DROP INDEX uk_scenic_knowledge_publication_active_slot,
    ADD UNIQUE INDEX uk_scenic_knowledge_publication_active_slot (facility_id, publish_slot);
