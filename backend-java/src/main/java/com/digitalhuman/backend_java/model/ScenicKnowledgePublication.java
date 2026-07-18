package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDateTime;
import java.util.Set;

@Entity
@Table(name = "scenic_knowledge_publication")
public class ScenicKnowledgePublication {
    public static final String STATUS_PUBLISHING = "publishing";
    public static final String STATUS_PUBLISHED = "published";
    public static final String STATUS_OUTDATED = "outdated";
    public static final String STATUS_FAILED = "failed";
    public static final String STATUS_WITHDRAWN = "withdrawn";

    private static final Set<String> VALID_STATUSES = Set.of(
            STATUS_PUBLISHING,
            STATUS_PUBLISHED,
            STATUS_OUTDATED,
            STATUS_FAILED,
            STATUS_WITHDRAWN);

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "facility_id", nullable = false)
    private Long facilityId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "knowledge_id", nullable = false, length = 100)
    private String knowledgeId;

    @Column(name = "knowledge_name", length = 255)
    private String knowledgeName;

    @Column(name = "document_id", length = 100)
    private String documentId;

    @Column(name = "logical_key", nullable = false, length = 255)
    private String logicalKey;

    @Column(name = "content_hash", nullable = false, length = 64)
    private String contentHash;

    @Column(nullable = false)
    private Integer version = 1;

    @Column(nullable = false, length = 20)
    private String status = STATUS_PUBLISHING;

    @Column(name = "last_error", length = 2000)
    private String lastError;

    @Column(name = "published_by", length = 100)
    private String publishedBy;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        status = requireValidStatus(status);
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        status = requireValidStatus(status);
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getFacilityId() {
        return facilityId;
    }

    public void setFacilityId(Long facilityId) {
        this.facilityId = facilityId;
    }

    public Long getAccountId() {
        return accountId;
    }

    public void setAccountId(Long accountId) {
        this.accountId = accountId;
    }

    public String getKnowledgeId() {
        return knowledgeId;
    }

    public void setKnowledgeId(String knowledgeId) {
        this.knowledgeId = knowledgeId;
    }

    public String getKnowledgeName() {
        return knowledgeName;
    }

    public void setKnowledgeName(String knowledgeName) {
        this.knowledgeName = knowledgeName;
    }

    public String getDocumentId() {
        return documentId;
    }

    public void setDocumentId(String documentId) {
        this.documentId = documentId;
    }

    public String getLogicalKey() {
        return logicalKey;
    }

    public void setLogicalKey(String logicalKey) {
        this.logicalKey = logicalKey;
    }

    public String getContentHash() {
        return contentHash;
    }

    public void setContentHash(String contentHash) {
        this.contentHash = contentHash;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = requireValidStatus(status);
    }

    public String getLastError() {
        return lastError;
    }

    public void setLastError(String lastError) {
        this.lastError = lastError;
    }

    public String getPublishedBy() {
        return publishedBy;
    }

    public void setPublishedBy(String publishedBy) {
        this.publishedBy = publishedBy;
    }

    public LocalDateTime getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(LocalDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    private String requireValidStatus(String value) {
        if (value == null || value.trim().isEmpty()) {
            throw new IllegalArgumentException("Scenic knowledge publication status must not be blank");
        }
        String normalized = value.trim();
        if (!VALID_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Unsupported scenic knowledge publication status: " + normalized);
        }
        return normalized;
    }
}
