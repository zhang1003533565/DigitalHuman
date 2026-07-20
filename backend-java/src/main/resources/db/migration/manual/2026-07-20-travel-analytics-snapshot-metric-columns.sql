ALTER TABLE travel_analytics_metric_snapshot
    ADD COLUMN total_samples BIGINT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    ADD COLUMN valid_samples BIGINT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    ADD COLUMN as_of DATETIME NULL;

ALTER TABLE travel_analytics_metric_snapshot
    ADD COLUMN methodology LONGTEXT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    ADD COLUMN warning LONGTEXT NULL;

UPDATE travel_analytics_metric_snapshot
SET total_samples = 0,
    valid_samples = 0,
    as_of = computed_at,
    methodology = '历史快照迁移：旧版仅保存 items_json，样本数无法可靠还原，已置为 0';

ALTER TABLE travel_analytics_metric_snapshot
    MODIFY COLUMN total_samples BIGINT NOT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    MODIFY COLUMN valid_samples BIGINT NOT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    MODIFY COLUMN as_of DATETIME NOT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    MODIFY COLUMN methodology LONGTEXT NOT NULL;

ALTER TABLE travel_analytics_metric_snapshot
    DROP COLUMN computed_at;
