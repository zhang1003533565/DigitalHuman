package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RagPromptConfigDto {

    private String version;
    @JsonProperty("systemPrompt")
    private String systemPrompt;
    private boolean enabled;
    @JsonProperty("createdAt")
    private String createdAt;
    private String status;

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getSystemPrompt() {
        return systemPrompt;
    }

    public void setSystemPrompt(String systemPrompt) {
        this.systemPrompt = systemPrompt;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(String createdAt) {
        this.createdAt = createdAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
