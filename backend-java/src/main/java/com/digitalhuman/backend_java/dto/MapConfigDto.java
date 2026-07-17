package com.digitalhuman.backend_java.dto;

public class MapConfigDto {
    private String amapKey = "";
    private String amapSecurityKey = "";
    private boolean configured;

    public MapConfigDto() {
    }

    public MapConfigDto(String amapKey, String amapSecurityKey) {
        this.amapKey = amapKey == null ? "" : amapKey;
        this.amapSecurityKey = amapSecurityKey == null ? "" : amapSecurityKey;
        this.configured = !this.amapKey.isBlank() && !this.amapSecurityKey.isBlank();
    }

    public String getAmapKey() {
        return amapKey;
    }

    public void setAmapKey(String amapKey) {
        this.amapKey = amapKey;
    }

    public String getAmapSecurityKey() {
        return amapSecurityKey;
    }

    public void setAmapSecurityKey(String amapSecurityKey) {
        this.amapSecurityKey = amapSecurityKey;
    }

    public boolean isConfigured() {
        return configured;
    }

    public void setConfigured(boolean configured) {
        this.configured = configured;
    }
}
