package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class KnowledgeBuildRequest {

    private Boolean recreateCollection;
    private String glob;
    private String fileName;
    private String embeddingProvider;
    private String embeddingModel;

    public Boolean getRecreateCollection() {
        return recreateCollection;
    }

    public void setRecreateCollection(Boolean recreateCollection) {
        this.recreateCollection = recreateCollection;
    }

    public String getGlob() {
        return glob;
    }

    public void setGlob(String glob) {
        this.glob = glob;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getEmbeddingModel() {
        return embeddingModel;
    }

    public void setEmbeddingModel(String embeddingModel) {
        this.embeddingModel = embeddingModel;
    }

    public String getEmbeddingProvider() {
        return embeddingProvider;
    }

    public void setEmbeddingProvider(String embeddingProvider) {
        this.embeddingProvider = embeddingProvider;
    }
}
