package com.digitalhuman.backend_java.dto;

public class ScenicFacilityContentResponse extends ScenicFacilityContentRequest {
    private Long facilityId;
    private Integer contentVersion;

    public Long getFacilityId() { return facilityId; }
    public void setFacilityId(Long value) { this.facilityId = value; }
    public Integer getContentVersion() { return contentVersion; }
    public void setContentVersion(Integer value) { this.contentVersion = value; }
}
