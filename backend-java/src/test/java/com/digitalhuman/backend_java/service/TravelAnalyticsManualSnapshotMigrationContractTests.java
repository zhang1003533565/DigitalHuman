package com.digitalhuman.backend_java.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class TravelAnalyticsManualSnapshotMigrationContractTests {

    @Test
    void manualSnapshotMigrationCreatesTablesUniqueKeyAndIdempotentSourceStateSeed() throws IOException {
        String sql = new ClassPathResource(
                "db/migration/manual/2026-07-20-travel-analytics-manual-snapshot.sql")
                .getContentAsString(StandardCharsets.UTF_8);

        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS travel_analytics_source_state"),
                "migration must create source-state table");
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS travel_analytics_snapshot_batch"),
                "migration must create snapshot-batch table");
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS travel_analytics_metric_snapshot"),
                "migration must create metric-snapshot table");
        assertTrue(sql.contains("UNIQUE (batch_id, scope, metric)"),
                "migration must enforce one scope/metric row per batch");
        assertTrue(sql.contains("total_samples BIGINT NOT NULL"),
                "migration must preserve total sample count outside items JSON");
        assertTrue(sql.contains("valid_samples BIGINT NOT NULL"),
                "migration must preserve valid sample count outside items JSON");
        assertTrue(sql.contains("as_of DATETIME NOT NULL"),
                "migration must preserve metric as-of time");
        assertTrue(sql.contains("methodology LONGTEXT NOT NULL"),
                "migration must preserve methodology outside items JSON");
        assertTrue(sql.contains("warning LONGTEXT NULL"),
                "migration must preserve nullable warning outside items JSON");
        assertTrue(!sql.contains("computed_at"),
                "migration must use as_of instead of the obsolete computed_at column");
        assertTrue(sql.contains("INSERT INTO travel_analytics_source_state (id, data_version, metric_config_version, updated_at)"),
                "migration must seed source-state id=1");
        assertTrue(sql.contains("VALUES (1, 0, 0, NOW())"),
                "migration must seed zeroed source-state versions");
        assertTrue(sql.contains("ON DUPLICATE KEY UPDATE id = id"),
                "migration seed must be idempotent");
    }
}
