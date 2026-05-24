package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RagQueryResponse {

    private String answer;
    @JsonProperty("relatedSpots")
    private List<String> relatedSpots;
    private List<RagSourceDto> sources;
    @JsonProperty("rewrittenQuestion")
    private String rewrittenQuestion;
    @JsonProperty("contextSufficient")
    private Boolean contextSufficient;
    @JsonProperty("contextReason")
    private String contextReason;
    @JsonProperty("qualityPassed")
    private Boolean qualityPassed;
    @JsonProperty("qualityIssues")
    private List<String> qualityIssues;
    @JsonProperty("citationsValid")
    private Boolean citationsValid;
    @JsonProperty("citationIssues")
    private List<String> citationIssues;
    @JsonProperty("reviewRequired")
    private Boolean reviewRequired;
    @JsonProperty("reviewReason")
    private String reviewReason;
    @JsonProperty("graphSteps")
    private List<String> graphSteps;
    @JsonProperty("retrievalAttempts")
    private Integer retrievalAttempts;

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public List<String> getRelatedSpots() {
        return relatedSpots;
    }

    public void setRelatedSpots(List<String> relatedSpots) {
        this.relatedSpots = relatedSpots;
    }

    public List<RagSourceDto> getSources() {
        return sources;
    }

    public void setSources(List<RagSourceDto> sources) {
        this.sources = sources;
    }

    public String getRewrittenQuestion() {
        return rewrittenQuestion;
    }

    public void setRewrittenQuestion(String rewrittenQuestion) {
        this.rewrittenQuestion = rewrittenQuestion;
    }

    public Boolean getContextSufficient() {
        return contextSufficient;
    }

    public void setContextSufficient(Boolean contextSufficient) {
        this.contextSufficient = contextSufficient;
    }

    public String getContextReason() {
        return contextReason;
    }

    public void setContextReason(String contextReason) {
        this.contextReason = contextReason;
    }

    public Boolean getQualityPassed() {
        return qualityPassed;
    }

    public void setQualityPassed(Boolean qualityPassed) {
        this.qualityPassed = qualityPassed;
    }

    public List<String> getQualityIssues() {
        return qualityIssues;
    }

    public void setQualityIssues(List<String> qualityIssues) {
        this.qualityIssues = qualityIssues;
    }

    public Boolean getCitationsValid() {
        return citationsValid;
    }

    public void setCitationsValid(Boolean citationsValid) {
        this.citationsValid = citationsValid;
    }

    public List<String> getCitationIssues() {
        return citationIssues;
    }

    public void setCitationIssues(List<String> citationIssues) {
        this.citationIssues = citationIssues;
    }

    public Boolean getReviewRequired() {
        return reviewRequired;
    }

    public void setReviewRequired(Boolean reviewRequired) {
        this.reviewRequired = reviewRequired;
    }

    public String getReviewReason() {
        return reviewReason;
    }

    public void setReviewReason(String reviewReason) {
        this.reviewReason = reviewReason;
    }

    public List<String> getGraphSteps() {
        return graphSteps;
    }

    public void setGraphSteps(List<String> graphSteps) {
        this.graphSteps = graphSteps;
    }

    public Integer getRetrievalAttempts() {
        return retrievalAttempts;
    }

    public void setRetrievalAttempts(Integer retrievalAttempts) {
        this.retrievalAttempts = retrievalAttempts;
    }
}
