package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "maxkb_open_api_config")
public class MaxKbOpenApiConfig {

    @Id
    @Column(length = 32)
    private String id = "default";

    @Column(nullable = false, length = 255)
    private String adminBaseUrl = "http://localhost:3000";

    @Column(nullable = false, length = 128)
    private String workspaceId = "default";

    @Column(nullable = false, length = 512)
    private String accessUrl = "http://localhost:3000/openapi/knowledge/v1/workspaces/default";

    @Column(nullable = false, length = 512)
    private String apiKey = "";

    @Column(length = 128)
    private String keyId = "";

    @Column(length = 128)
    private String keyName = "";

    @Column(length = 128)
    private String defaultKnowledgeId = "";

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAdminBaseUrl() {
        return adminBaseUrl;
    }

    public void setAdminBaseUrl(String adminBaseUrl) {
        this.adminBaseUrl = adminBaseUrl;
    }

    public String getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(String workspaceId) {
        this.workspaceId = workspaceId;
    }

    public String getAccessUrl() {
        return accessUrl;
    }

    public void setAccessUrl(String accessUrl) {
        this.accessUrl = accessUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }

    public String getKeyId() {
        return keyId;
    }

    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }

    public String getKeyName() {
        return keyName;
    }

    public void setKeyName(String keyName) {
        this.keyName = keyName;
    }

    public String getDefaultKnowledgeId() {
        return defaultKnowledgeId;
    }

    public void setDefaultKnowledgeId(String defaultKnowledgeId) {
        this.defaultKnowledgeId = defaultKnowledgeId;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
