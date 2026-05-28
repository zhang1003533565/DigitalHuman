package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class RagLlmConfigDto {

    private String provider;
    private String model;

    @JsonProperty("timeoutSeconds")
    private int timeoutSeconds;

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public int getTimeoutSeconds() {
        return timeoutSeconds;
    }

    public void setTimeoutSeconds(int timeoutSeconds) {
        this.timeoutSeconds = timeoutSeconds;
    }
}
