package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class KnowledgeUploadResponse {

    @JsonProperty("file_name")
    private String fileName;
    @JsonProperty("size_bytes")
    private Long sizeBytes;
    @JsonProperty("updated_at")
    private String updatedAt;
    private Boolean supported;

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public Long getSizeBytes() {
        return sizeBytes;
    }

    public void setSizeBytes(Long sizeBytes) {
        this.sizeBytes = sizeBytes;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Boolean getSupported() {
        return supported;
    }

    public void setSupported(Boolean supported) {
        this.supported = supported;
    }
}
