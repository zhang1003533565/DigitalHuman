package com.digitalhuman.backend_java.dto;

public class AdminModelOptionDto {

    private String category;
    private String provider;
    private String modelId;

    public AdminModelOptionDto() {
    }

    public AdminModelOptionDto(String category, String provider, String modelId) {
        this.category = category;
        this.provider = provider;
        this.modelId = modelId;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }
}
