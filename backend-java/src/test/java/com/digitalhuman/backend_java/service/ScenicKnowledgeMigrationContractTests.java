package com.digitalhuman.backend_java.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ScenicKnowledgeMigrationContractTests {

    @Test
    void singleTargetMigrationBlocksIndexSwapWhenLegacyActiveDocumentsConflict() throws IOException {
        String sql = new ClassPathResource(
                "db/migration/manual/2026-07-20-scenic-knowledge-single-target.sql")
                .getContentAsString(StandardCharsets.UTF_8);

        int guardPosition = sql.indexOf("CREATE TEMPORARY TABLE scenic_knowledge_single_target_guard");
        int indexSwapPosition = sql.indexOf("ALTER TABLE scenic_knowledge_publication");

        assertTrue(guardPosition >= 0, "migration must create a fail-closed duplicate guard");
        assertTrue(indexSwapPosition > guardPosition, "duplicate guard must run before the index swap");
        assertTrue(sql.contains("status IN ('published', 'outdated')"),
                "preflight must inspect every status that represents a live remote document");
        assertTrue(sql.contains("docs/operations/scenic-knowledge-single-target-migration.md"),
                "migration must point operators to the remote cleanup runbook");
    }
}
