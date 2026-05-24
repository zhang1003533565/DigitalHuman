package com.digitalhuman.backend_java.dto;

public class KnowledgeBuildRequest {

    private Boolean recreateCollection;
    private String glob;
    private String fileName;

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
}
