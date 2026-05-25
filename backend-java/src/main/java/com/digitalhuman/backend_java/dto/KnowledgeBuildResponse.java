package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class KnowledgeBuildResponse {

    @JsonProperty("files_seen")
    private Integer filesSeen;
    @JsonProperty("files_indexed")
    private Integer filesIndexed;
    @JsonProperty("chunks_indexed")
    private Integer chunksIndexed;
    private String collection;
    @JsonProperty("embeddingProvider")
    private String embeddingProvider;
    @JsonProperty("embeddingModel")
    private String embeddingModel;

    public Integer getFilesSeen() {
        return filesSeen;
    }

    public void setFilesSeen(Integer filesSeen) {
        this.filesSeen = filesSeen;
    }

    public Integer getFilesIndexed() {
        return filesIndexed;
    }

    public void setFilesIndexed(Integer filesIndexed) {
        this.filesIndexed = filesIndexed;
    }

    public Integer getChunksIndexed() {
        return chunksIndexed;
    }

    public void setChunksIndexed(Integer chunksIndexed) {
        this.chunksIndexed = chunksIndexed;
    }

    public String getCollection() {
        return collection;
    }

    public void setCollection(String collection) {
        this.collection = collection;
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
