package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public class GuideSourceDto {

    @JsonProperty("doc_id")
    private String docId;
    @JsonProperty("paragraph_id")
    private String paragraphId;
    @JsonProperty("knowledge_name")
    private String knowledgeName;
    @JsonProperty("document_name")
    private String documentName;
    @JsonProperty("source_file")
    private String sourceFile;
    private String title;
    private String content;
    private Double similarity;
    @JsonProperty("comprehensive_score")
    private Double comprehensiveScore;
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

    public String getParagraphId() {
        return paragraphId;
    }

    public void setParagraphId(String paragraphId) {
        this.paragraphId = paragraphId;
    }

    public String getKnowledgeName() {
        return knowledgeName;
    }

    public void setKnowledgeName(String knowledgeName) {
        this.knowledgeName = knowledgeName;
    }

    public String getDocumentName() {
        return documentName;
    }

    public void setDocumentName(String documentName) {
        this.documentName = documentName;
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

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Double getSimilarity() {
        return similarity;
    }

    public void setSimilarity(Double similarity) {
        this.similarity = similarity;
    }

    public Double getComprehensiveScore() {
        return comprehensiveScore;
    }

    public void setComprehensiveScore(Double comprehensiveScore) {
        this.comprehensiveScore = comprehensiveScore;
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
