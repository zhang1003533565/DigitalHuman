package com.digitalhuman.backend_java.dto;

import java.util.List;

public class AdminModelCatalogDto {

    private List<AdminModelOptionDto> embeddingModels;
    private List<AdminModelOptionDto> speechModels;
    private List<AdminModelOptionDto> visionModels;
    private List<AdminModelOptionDto> chatModels;
    private List<AdminModelOptionDto> multimodalModels;

    public AdminModelCatalogDto() {
    }

    public AdminModelCatalogDto(
            List<AdminModelOptionDto> embeddingModels,
            List<AdminModelOptionDto> speechModels,
            List<AdminModelOptionDto> visionModels,
            List<AdminModelOptionDto> chatModels,
            List<AdminModelOptionDto> multimodalModels) {
        this.embeddingModels = embeddingModels;
        this.speechModels = speechModels;
        this.visionModels = visionModels;
        this.chatModels = chatModels;
        this.multimodalModels = multimodalModels;
    }

    public List<AdminModelOptionDto> getEmbeddingModels() {
        return embeddingModels;
    }

    public void setEmbeddingModels(List<AdminModelOptionDto> embeddingModels) {
        this.embeddingModels = embeddingModels;
    }

    public List<AdminModelOptionDto> getSpeechModels() {
        return speechModels;
    }

    public void setSpeechModels(List<AdminModelOptionDto> speechModels) {
        this.speechModels = speechModels;
    }

    public List<AdminModelOptionDto> getVisionModels() {
        return visionModels;
    }

    public void setVisionModels(List<AdminModelOptionDto> visionModels) {
        this.visionModels = visionModels;
    }

    public List<AdminModelOptionDto> getMultimodalModels() {
        return multimodalModels;
    }

    public void setMultimodalModels(List<AdminModelOptionDto> multimodalModels) {
        this.multimodalModels = multimodalModels;
    }

    public List<AdminModelOptionDto> getChatModels() {
        return chatModels;
    }

    public void setChatModels(List<AdminModelOptionDto> chatModels) {
        this.chatModels = chatModels;
    }
}
