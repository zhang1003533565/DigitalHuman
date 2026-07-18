package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public class ScenicStructuredApplyRequest {
    @NotNull
    private Long facilityId;
    private String mode = "fill_empty";
    private List<String> fields = List.of();

    public Long getFacilityId() { return facilityId; }
    public void setFacilityId(Long value) { this.facilityId = value; }
    public String getMode() { return mode; }
    public void setMode(String value) { this.mode = value; }
    public List<String> getFields() { return fields; }
    public void setFields(List<String> value) { this.fields = value == null ? List.of() : value; }
}
