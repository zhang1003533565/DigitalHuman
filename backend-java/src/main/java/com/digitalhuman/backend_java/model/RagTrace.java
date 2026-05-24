package com.digitalhuman.backend_java.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "rag_trace")
public class RagTrace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String traceId;

    @Column(nullable = false, length = 80)
    private String sessionId;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(nullable = false, length = 500)
    private String question;

    @Column(length = 200)
    private String interest;

    @Column(length = 500)
    private String answerPreview;

    @Column(length = 500)
    private String rewrittenQuestion;

    @Column(length = 1000)
    private String failureReason;

    @Column(length = 1000)
    private String reviewReason;

    @Column(length = 1000)
    private String lowConfidenceReason;

    @Column(length = 30)
    private String reviewStatus;

    @Column(length = 2000)
    private String reviewedAnswer;

    @Column(length = 1000)
    private String reviewComment;

    @Column(nullable = false)
    private boolean contextSufficient;

    @Column(nullable = false)
    private boolean qualityPassed;

    @Column(nullable = false)
    private boolean citationsValid;

    @Column(nullable = false)
    private boolean reviewRequired;

    @Column(nullable = false)
    private boolean lowConfidence;

    @Column(nullable = false)
    private boolean noAnswer;

    private Integer retrievalAttempts;

    private Double totalDurationMs;

    @Column(length = 80)
    private String promptVersion;

    @Column(length = 50)
    private String providerStatus;

    @Column(length = 1000)
    private String providerError;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Lob
    private String requestJson;

    @Lob
    private String responseJson;

    public Long getId() {
        return id;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getInterest() {
        return interest;
    }

    public void setInterest(String interest) {
        this.interest = interest;
    }

    public String getAnswerPreview() {
        return answerPreview;
    }

    public void setAnswerPreview(String answerPreview) {
        this.answerPreview = answerPreview;
    }

    public String getRewrittenQuestion() {
        return rewrittenQuestion;
    }

    public void setRewrittenQuestion(String rewrittenQuestion) {
        this.rewrittenQuestion = rewrittenQuestion;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public void setFailureReason(String failureReason) {
        this.failureReason = failureReason;
    }

    public String getReviewReason() {
        return reviewReason;
    }

    public void setReviewReason(String reviewReason) {
        this.reviewReason = reviewReason;
    }

    public String getLowConfidenceReason() {
        return lowConfidenceReason;
    }

    public void setLowConfidenceReason(String lowConfidenceReason) {
        this.lowConfidenceReason = lowConfidenceReason;
    }

    public String getReviewStatus() {
        return reviewStatus;
    }

    public void setReviewStatus(String reviewStatus) {
        this.reviewStatus = reviewStatus;
    }

    public String getReviewedAnswer() {
        return reviewedAnswer;
    }

    public void setReviewedAnswer(String reviewedAnswer) {
        this.reviewedAnswer = reviewedAnswer;
    }

    public String getReviewComment() {
        return reviewComment;
    }

    public void setReviewComment(String reviewComment) {
        this.reviewComment = reviewComment;
    }

    public boolean isContextSufficient() {
        return contextSufficient;
    }

    public void setContextSufficient(boolean contextSufficient) {
        this.contextSufficient = contextSufficient;
    }

    public boolean isQualityPassed() {
        return qualityPassed;
    }

    public void setQualityPassed(boolean qualityPassed) {
        this.qualityPassed = qualityPassed;
    }

    public boolean isCitationsValid() {
        return citationsValid;
    }

    public void setCitationsValid(boolean citationsValid) {
        this.citationsValid = citationsValid;
    }

    public boolean isReviewRequired() {
        return reviewRequired;
    }

    public void setReviewRequired(boolean reviewRequired) {
        this.reviewRequired = reviewRequired;
    }

    public boolean isLowConfidence() {
        return lowConfidence;
    }

    public void setLowConfidence(boolean lowConfidence) {
        this.lowConfidence = lowConfidence;
    }

    public boolean isNoAnswer() {
        return noAnswer;
    }

    public void setNoAnswer(boolean noAnswer) {
        this.noAnswer = noAnswer;
    }

    public Integer getRetrievalAttempts() {
        return retrievalAttempts;
    }

    public void setRetrievalAttempts(Integer retrievalAttempts) {
        this.retrievalAttempts = retrievalAttempts;
    }

    public Double getTotalDurationMs() {
        return totalDurationMs;
    }

    public void setTotalDurationMs(Double totalDurationMs) {
        this.totalDurationMs = totalDurationMs;
    }

    public String getPromptVersion() {
        return promptVersion;
    }

    public void setPromptVersion(String promptVersion) {
        this.promptVersion = promptVersion;
    }

    public String getProviderStatus() {
        return providerStatus;
    }

    public void setProviderStatus(String providerStatus) {
        this.providerStatus = providerStatus;
    }

    public String getProviderError() {
        return providerError;
    }

    public void setProviderError(String providerError) {
        this.providerError = providerError;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getRequestJson() {
        return requestJson;
    }

    public void setRequestJson(String requestJson) {
        this.requestJson = requestJson;
    }

    public String getResponseJson() {
        return responseJson;
    }

    public void setResponseJson(String responseJson) {
        this.responseJson = responseJson;
    }
}
