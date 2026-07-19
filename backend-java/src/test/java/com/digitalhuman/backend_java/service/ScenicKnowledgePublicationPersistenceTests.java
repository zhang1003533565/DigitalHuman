package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.ScenicKnowledgePublication;
import com.digitalhuman.backend_java.repository.ScenicKnowledgePublicationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest
class ScenicKnowledgePublicationPersistenceTests {

    @Autowired
    private ScenicKnowledgePublicationRepository publicationRepository;

    @Test
    void duplicateActivePublishSlotForSameTargetIsRejectedByJpaConstraint() {
        publicationRepository.saveAndFlush(publication(12L, 3L, "kb-1", ScenicKnowledgePublication.PUBLISH_SLOT_ACTIVE_REMOTE));

        assertThrows(
                DataIntegrityViolationException.class,
                () -> publicationRepository.saveAndFlush(publication(
                        12L,
                        3L,
                        "kb-1",
                        ScenicKnowledgePublication.PUBLISH_SLOT_ACTIVE_REMOTE)));
    }

    @Test
    void terminalRowsWithNullPublishSlotCanCoexistForSameTarget() {
        assertDoesNotThrow(() -> {
            publicationRepository.saveAndFlush(publication(12L, 3L, "kb-1", null));
            publicationRepository.saveAndFlush(publication(12L, 3L, "kb-1", null));
        });

        assertEquals(2L, publicationRepository.count());
    }

    private ScenicKnowledgePublication publication(Long facilityId, Long accountId, String knowledgeId, Integer publishSlot) {
        ScenicKnowledgePublication publication = new ScenicKnowledgePublication();
        publication.setFacilityId(facilityId);
        publication.setAccountId(accountId);
        publication.setKnowledgeId(knowledgeId);
        publication.setKnowledgeName("灵山知识库");
        publication.setDocumentId(publishSlot == null ? "doc-terminal-" + System.nanoTime() : null);
        publication.setLogicalKey("scenic:" + facilityId + ":" + knowledgeId + ":" + System.nanoTime());
        publication.setContentHash(String.format("%064d", Math.abs(System.nanoTime())));
        publication.setPublishSlot(publishSlot);
        publication.setVersion(1);
        publication.setStatus(publishSlot == null
                ? ScenicKnowledgePublication.STATUS_PUBLISHED
                : ScenicKnowledgePublication.STATUS_PUBLISHING);
        return publication;
    }
}
