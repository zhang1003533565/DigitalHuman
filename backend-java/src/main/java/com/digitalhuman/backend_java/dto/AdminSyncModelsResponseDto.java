package com.digitalhuman.backend_java.dto;

import java.util.List;

public class AdminSyncModelsResponseDto {

    private String provider;
    private String category;
    private String baseUrl;
    private int syncedCount;
    private List<String> modelIds;

    public AdminSyncModelsResponseDto() {
    }

    public AdminSyncModelsResponseDto(String provider, String category, String baseUrl, int syncedCount, List<String> modelIds) {
        this.provider = provider;
        this.category = category;
        this.baseUrl = baseUrl;
        this.syncedCount = syncedCount;
        this.modelIds = modelIds;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public int getSyncedCount() {
        return syncedCount;
    }

    public void setSyncedCount(int syncedCount) {
        this.syncedCount = syncedCount;
    }

    public List<String> getModelIds() {
        return modelIds;
    }

    public void setModelIds(List<String> modelIds) {
        this.modelIds = modelIds;
    }
}
