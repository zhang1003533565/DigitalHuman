package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class KnowledgeDeleteResponse {

    @JsonProperty("fileName")
    private String fileName;
    @JsonProperty("fileDeleted")
    private boolean fileDeleted;
    @JsonProperty("vectorsDeleted")
    private Integer vectorsDeleted;

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public boolean isFileDeleted() {
        return fileDeleted;
    }

    public void setFileDeleted(boolean fileDeleted) {
        this.fileDeleted = fileDeleted;
    }

    public Integer getVectorsDeleted() {
        return vectorsDeleted;
    }

    public void setVectorsDeleted(Integer vectorsDeleted) {
        this.vectorsDeleted = vectorsDeleted;
    }
}
