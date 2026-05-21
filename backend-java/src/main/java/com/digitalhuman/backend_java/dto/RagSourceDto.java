package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class RagSourceDto {

    @JsonProperty("doc_id")
    private String docId;
    @JsonProperty("source_file")
    private String sourceFile;
    private String title;
    @JsonProperty("section_path")
    private List<String> sectionPath;
    @JsonProperty("chunk_index")
    private Integer chunkIndex;
    private List<String> tags;
    @JsonProperty("spot_name")
    private String spotName;
    @JsonProperty("content_type")
    private String contentType;
    @JsonProperty("updated_at")
    private String updatedAt;

    public String getDocId() {
        return docId;
    }

    public void setDocId(String docId) {
        this.docId = docId;
    }

    public String getSourceFile() {
        return sourceFile;
    }

    public void setSourceFile(String sourceFile) {
        this.sourceFile = sourceFile;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public List<String> getSectionPath() {
        return sectionPath;
    }

    public void setSectionPath(List<String> sectionPath) {
        this.sectionPath = sectionPath;
    }

    public Integer getChunkIndex() {
        return chunkIndex;
    }

    public void setChunkIndex(Integer chunkIndex) {
        this.chunkIndex = chunkIndex;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public String getSpotName() {
        return spotName;
    }

    public void setSpotName(String spotName) {
        this.spotName = spotName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public String getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(String updatedAt) {
        this.updatedAt = updatedAt;
    }
}
