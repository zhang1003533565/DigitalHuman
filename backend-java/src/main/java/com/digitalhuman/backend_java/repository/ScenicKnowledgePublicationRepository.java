package com.digitalhuman.backend_java.repository;

import com.digitalhuman.backend_java.model.ScenicKnowledgePublication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.Optional;

public interface ScenicKnowledgePublicationRepository extends JpaRepository<ScenicKnowledgePublication, Long> {

    Optional<ScenicKnowledgePublication> findFirstByFacilityIdAndAccountIdAndKnowledgeIdOrderByVersionDesc(
            Long facilityId,
            Long accountId,
            String knowledgeId);

    Optional<ScenicKnowledgePublication> findFirstByFacilityIdAndAccountIdAndKnowledgeIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
            Long facilityId,
            Long accountId,
            String knowledgeId,
            Collection<String> statuses,
            String blankDocumentId);

    Optional<ScenicKnowledgePublication> findFirstByFacilityIdAndStatusInAndDocumentIdIsNotNullAndDocumentIdNotOrderByUpdatedAtDescIdDesc(
            Long facilityId,
            Collection<String> statuses,
            String blankDocumentId);

    Optional<ScenicKnowledgePublication> findFirstByFacilityIdOrderByUpdatedAtDescIdDesc(Long facilityId);
}
