package com.digitalhuman.backend_java.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TravelAnalyticsMetricColumnsUpgradeMigrationTests {

    private static final String MIGRATION_PATH =
            "db/migration/manual/2026-07-20-travel-analytics-snapshot-metric-columns.sql";
    private static final String MIGRATION_METHODOLOGY =
            "历史快照迁移：旧版仅保存 items_json，样本数无法可靠还原，已置为 0";

    @Test
    void upgradeMigrationAddsNullableColumnsBackfillsHardensThenDropsComputedAt() throws IOException {
        String sql = migrationSql();

        assertFalse(sql.contains("CREATE TABLE"),
                "upgrade migration must alter an existing old-schema table");
        int addTotalSamples = positionOf(sql, "ADD COLUMN total_samples BIGINT NULL");
        int addValidSamples = positionOf(sql, "ADD COLUMN valid_samples BIGINT NULL");
        int addAsOf = positionOf(sql, "ADD COLUMN as_of DATETIME NULL");
        int addMethodology = positionOf(sql, "ADD COLUMN methodology LONGTEXT NULL");
        int addWarning = positionOf(sql, "ADD COLUMN warning LONGTEXT NULL");
        int update = positionOf(sql, "UPDATE travel_analytics_metric_snapshot");
        int backfillAsOf = positionOf(sql, "as_of = computed_at");
        int migrationMethodology = positionOf(sql, MIGRATION_METHODOLOGY);
        int hardenTotalSamples = positionOf(sql, "MODIFY COLUMN total_samples BIGINT NOT NULL");
        int hardenValidSamples = positionOf(sql, "MODIFY COLUMN valid_samples BIGINT NOT NULL");
        int hardenAsOf = positionOf(sql, "MODIFY COLUMN as_of DATETIME NOT NULL");
        int hardenMethodology = positionOf(sql, "MODIFY COLUMN methodology LONGTEXT NOT NULL");
        int dropComputedAt = positionOf(sql, "DROP COLUMN computed_at");

        assertTrue(addTotalSamples < update);
        assertTrue(addValidSamples < update);
        assertTrue(addAsOf < update);
        assertTrue(addMethodology < update);
        assertTrue(addWarning < update);
        assertTrue(update < backfillAsOf);
        assertTrue(update < migrationMethodology);
        assertTrue(backfillAsOf < hardenTotalSamples);
        assertTrue(migrationMethodology < hardenTotalSamples);
        assertTrue(hardenTotalSamples < dropComputedAt);
        assertTrue(hardenValidSamples < dropComputedAt);
        assertTrue(hardenAsOf < dropComputedAt);
        assertTrue(hardenMethodology < dropComputedAt);
    }

    @Test
    void upgradeMigrationExecutesAgainstOldSchemaInH2MySqlMode() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:travel_snapshot_metric_upgrade;MODE=MySQL", "sa", "")) {
            createOldSchemaWithHistoricalRow(connection);
            executeMigration(connection, migrationSql());

            try (Statement statement = connection.createStatement();
                    ResultSet row = statement.executeQuery("""
                            SELECT total_samples, valid_samples, as_of, methodology, warning
                            FROM travel_analytics_metric_snapshot
                            WHERE id = 1
                            """)) {
                assertTrue(row.next());
                assertEquals(0L, row.getLong("total_samples"));
                assertEquals(0L, row.getLong("valid_samples"));
                assertEquals(
                        LocalDateTime.of(2026, 7, 20, 9, 30),
                        row.getTimestamp("as_of").toLocalDateTime());
                assertEquals(MIGRATION_METHODOLOGY, row.getString("methodology"));
                assertNull(row.getString("warning"));
            }

            assertRequiredColumn(connection, "TOTAL_SAMPLES");
            assertRequiredColumn(connection, "VALID_SAMPLES");
            assertRequiredColumn(connection, "AS_OF");
            assertRequiredColumn(connection, "METHODOLOGY");
            assertNullableColumn(connection, "WARNING");
            assertThrows(SQLException.class, () -> {
                try (Statement statement = connection.createStatement()) {
                    statement.executeQuery(
                            "SELECT computed_at FROM travel_analytics_metric_snapshot");
                }
            });
        }
    }

    private String migrationSql() throws IOException {
        return new ClassPathResource(MIGRATION_PATH)
                .getContentAsString(StandardCharsets.UTF_8);
    }

    private int positionOf(String sql, String fragment) {
        int position = sql.indexOf(fragment);
        assertTrue(position >= 0, () -> "migration must contain: " + fragment);
        return position;
    }

    private void createOldSchemaWithHistoricalRow(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE travel_analytics_metric_snapshot (
                        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                        batch_id BIGINT NOT NULL,
                        scope VARCHAR(32) NOT NULL,
                        metric VARCHAR(64) NOT NULL,
                        items_json LONGTEXT NOT NULL,
                        computed_at DATETIME NOT NULL
                    )
                    """);
            statement.executeUpdate("""
                    INSERT INTO travel_analytics_metric_snapshot
                        (id, batch_id, scope, metric, items_json, computed_at)
                    VALUES
                        (1, 11, 'ADMIN', 'AVERAGE_SPEND', '[]', '2026-07-20 09:30:00')
                    """);
        }
    }

    private void executeMigration(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            for (String command : sql.split(";")) {
                if (!command.isBlank()) {
                    statement.execute(command.trim());
                }
            }
        }
    }

    private void assertRequiredColumn(Connection connection, String columnName) throws SQLException {
        assertEquals("NO", columnNullability(connection, columnName));
    }

    private void assertNullableColumn(Connection connection, String columnName) throws SQLException {
        assertEquals("YES", columnNullability(connection, columnName));
    }

    private String columnNullability(Connection connection, String columnName) throws SQLException {
        try (var statement = connection.prepareStatement("""
                SELECT IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME = 'TRAVEL_ANALYTICS_METRIC_SNAPSHOT'
                  AND COLUMN_NAME = ?
                """)) {
            statement.setString(1, columnName);
            try (ResultSet result = statement.executeQuery()) {
                assertTrue(result.next(), () -> "missing column " + columnName);
                return result.getString("IS_NULLABLE");
            }
        }
    }
}
