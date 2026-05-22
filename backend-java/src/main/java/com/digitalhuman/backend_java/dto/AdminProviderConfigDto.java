package com.digitalhuman.backend_java.dto;

public class AdminProviderConfigDto {

    private String provider;
    private String baseUrl;
    private String apiKey;

    public AdminProviderConfigDto() {
    }

    public AdminProviderConfigDto(String provider, String baseUrl, String apiKey) {
        this.provider = provider;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getApiKey() {
        return apiKey;
    }

    public void setApiKey(String apiKey) {
        this.apiKey = apiKey;
    }
}
