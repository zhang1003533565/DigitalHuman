package com.digitalhuman.backend_java.service;

import com.digitalhuman.backend_java.model.ScenicKnowledgePublication;
import com.digitalhuman.backend_java.repository.ScenicKnowledgePublicationRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ScenicKnowledgePublicationStateService {

    private final ScenicKnowledgePublicationRepository publicationRepository;

    public ScenicKnowledgePublicationStateService(ScenicKnowledgePublicationRepository publicationRepository) {
        this.publicationRepository = publicationRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reservePublishingSlot(ScenicKnowledgePublication publication) {
        try {
            publicationRepository.saveAndFlush(publication);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "当前景点已有发布任务正在进行中");
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void activatePublication(
            ScenicKnowledgePublication publication,
            ScenicKnowledgePublication previousActive,
            String terminalStatus) {
        publication.setStatus(terminalStatus);
        publication.setPublishSlot(null);
        publicationRepository.save(publication);
        if (shouldRetire(previousActive, publication)) {
            previousActive.setStatus(ScenicKnowledgePublication.STATUS_WITHDRAWN);
            previousActive.setPublishSlot(null);
            previousActive.setLastError(null);
            publicationRepository.save(previousActive);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markFailed(ScenicKnowledgePublication publication, String sanitizedError) {
        publication.setStatus(ScenicKnowledgePublication.STATUS_FAILED);
        publication.setPublishSlot(null);
        publication.setLastError(sanitizedError);
        publicationRepository.save(publication);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void restorePreviousActiveAndMarkNewFailed(
            ScenicKnowledgePublication publication,
            ScenicKnowledgePublication previousActive,
            String restoredStatus,
            String sanitizedError) {
        if (previousActive != null) {
            previousActive.setStatus(restoredStatus);
            previousActive.setPublishSlot(null);
            previousActive.setLastError(null);
            publicationRepository.save(previousActive);
        }
        publication.setStatus(ScenicKnowledgePublication.STATUS_FAILED);
        publication.setPublishSlot(null);
        publication.setLastError(sanitizedError);
        publicationRepository.save(publication);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recoverPreviousActive(ScenicKnowledgePublication previousActive, String restoredStatus) {
        if (previousActive == null) {
            return;
        }
        previousActive.setStatus(restoredStatus);
        previousActive.setPublishSlot(null);
        previousActive.setLastError(null);
        publicationRepository.save(previousActive);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCleanupFailureOnActivePublication(
            ScenicKnowledgePublication publication,
            String sanitizedError) {
        publication.setPublishSlot(null);
        publication.setLastError(sanitizedError);
        publicationRepository.save(publication);
    }

    private boolean shouldRetire(ScenicKnowledgePublication previousActive, ScenicKnowledgePublication publication) {
        return previousActive != null
                && previousActive.getDocumentId() != null
                && !previousActive.getDocumentId().isBlank()
                && !previousActive.getDocumentId().equals(publication.getDocumentId());
    }
}
