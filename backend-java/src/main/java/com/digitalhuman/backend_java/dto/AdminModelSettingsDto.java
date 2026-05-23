package com.digitalhuman.backend_java.dto;

public class AdminModelSettingsDto {

    private String embeddingModel;
    private String speechModel;
    private String visionModel;
    private String chatModel;
    private String multimodalModel;

    public AdminModelSettingsDto() {
    }

    public AdminModelSettingsDto(String embeddingModel, String speechModel, String visionModel, String chatModel, String multimodalModel) {
        this.embeddingModel = embeddingModel;
        this.speechModel = speechModel;
        this.visionModel = visionModel;
        this.chatModel = chatModel;
        this.multimodalModel = multimodalModel;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public void setEmbeddingModel(String embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    public String getSpeechModel() {
        return speechModel;
    }

    public void setSpeechModel(String speechModel) {
        this.speechModel = speechModel;
    }

    public String getVisionModel() {
        return visionModel;
    }

    public void setVisionModel(String visionModel) {
        this.visionModel = visionModel;
    }

    public String getMultimodalModel() {
        return multimodalModel;
    }

    public void setMultimodalModel(String multimodalModel) {
        this.multimodalModel = multimodalModel;
    }

    public String getChatModel() {
        return chatModel;
    }

    public void setChatModel(String chatModel) {
        this.chatModel = chatModel;
    }
}
