CREATE TABLE IF NOT EXISTS travel_analytics_source_state (
    id BIGINT NOT NULL PRIMARY KEY,
    data_version BIGINT NOT NULL,
    metric_config_version BIGINT NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS travel_analytics_snapshot_batch (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    status VARCHAR(32) NOT NULL,
    source_data_version BIGINT NOT NULL,
    metric_config_version BIGINT NOT NULL,
    source_record_count BIGINT NULL,
    source_max_updated_at DATETIME NULL,
    created_by VARCHAR(100) NULL,
    created_by_display_name VARCHAR(100) NULL,
    failure_summary LONGTEXT NULL,
    created_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    INDEX idx_travel_analytics_snapshot_batch_ready_latest (status, completed_at, id),
    INDEX idx_travel_analytics_snapshot_batch_building_latest (status, created_at, id)
);

CREATE TABLE IF NOT EXISTS travel_analytics_metric_snapshot (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    batch_id BIGINT NOT NULL,
    scope VARCHAR(32) NOT NULL,
    metric VARCHAR(64) NOT NULL,
    items_json LONGTEXT NOT NULL,
    total_samples BIGINT NOT NULL,
    valid_samples BIGINT NOT NULL,
    as_of DATETIME NOT NULL,
    methodology LONGTEXT NOT NULL,
    warning LONGTEXT NULL,
    CONSTRAINT uk_travel_analytics_snapshot_metric UNIQUE (batch_id, scope, metric),
    CONSTRAINT fk_travel_analytics_metric_snapshot_batch
        FOREIGN KEY (batch_id) REFERENCES travel_analytics_snapshot_batch (id)
);

INSERT INTO travel_analytics_source_state (id, data_version, metric_config_version, updated_at)
VALUES (1, 0, 0, NOW())
ON DUPLICATE KEY UPDATE id = id;
