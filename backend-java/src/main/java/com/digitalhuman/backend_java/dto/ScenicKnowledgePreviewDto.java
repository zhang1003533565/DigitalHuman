package com.digitalhuman.backend_java.dto;

public class ScenicKnowledgePreviewDto {

    private Long recordId;
    private Long facilityId;
    private String fileName;
    private String markdown;
    private String sha256;
    private Integer contentVersion;

    public Long getRecordId() {
        return recordId;
    }

    public void setRecordId(Long recordId) {
        this.recordId = recordId;
    }

    public Long getFacilityId() {
        return facilityId;
    }

    public void setFacilityId(Long facilityId) {
        this.facilityId = facilityId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getMarkdown() {
        return markdown;
    }

    public void setMarkdown(String markdown) {
        this.markdown = markdown;
    }

    public String getSha256() {
        return sha256;
    }

    public void setSha256(String sha256) {
        this.sha256 = sha256;
    }

    public Integer getContentVersion() {
        return contentVersion;
    }

    public void setContentVersion(Integer contentVersion) {
        this.contentVersion = contentVersion;
    }
}
