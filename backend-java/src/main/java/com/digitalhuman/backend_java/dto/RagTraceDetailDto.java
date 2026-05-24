package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDateTime;

public class RagTraceDetailDto {

    private final String traceId;
    private final String sessionId;
    private final String status;
    private final String question;
    private final String interest;
    private final String failureReason;
    private final String reviewReason;
    private final String lowConfidenceReason;
    private final boolean contextSufficient;
    private final boolean qualityPassed;
    private final boolean citationsValid;
    private final boolean reviewRequired;
    private final boolean lowConfidence;
    private final boolean noAnswer;
    private final Integer retrievalAttempts;
    private final Double totalDurationMs;
    private final LocalDateTime createdAt;
    private final JsonNode request;
    private final JsonNode response;

    public RagTraceDetailDto(
            String traceId,
            String sessionId,
            String status,
            String question,
            String interest,
            String failureReason,
            String reviewReason,
            String lowConfidenceReason,
            boolean contextSufficient,
            boolean qualityPassed,
            boolean citationsValid,
            boolean reviewRequired,
            boolean lowConfidence,
            boolean noAnswer,
            Integer retrievalAttempts,
            Double totalDurationMs,
            LocalDateTime createdAt,
            JsonNode request,
            JsonNode response) {
        this.traceId = traceId;
        this.sessionId = sessionId;
        this.status = status;
        this.question = question;
        this.interest = interest;
        this.failureReason = failureReason;
        this.reviewReason = reviewReason;
        this.lowConfidenceReason = lowConfidenceReason;
        this.contextSufficient = contextSufficient;
        this.qualityPassed = qualityPassed;
        this.citationsValid = citationsValid;
        this.reviewRequired = reviewRequired;
        this.lowConfidence = lowConfidence;
        this.noAnswer = noAnswer;
        this.retrievalAttempts = retrievalAttempts;
        this.totalDurationMs = totalDurationMs;
        this.createdAt = createdAt;
        this.request = request;
        this.response = response;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getStatus() {
        return status;
    }

    public String getQuestion() {
        return question;
    }

    public String getInterest() {
        return interest;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public String getReviewReason() {
        return reviewReason;
    }

    public String getLowConfidenceReason() {
        return lowConfidenceReason;
    }

    public boolean isContextSufficient() {
        return contextSufficient;
    }

    public boolean isQualityPassed() {
        return qualityPassed;
    }

    public boolean isCitationsValid() {
        return citationsValid;
    }

    public boolean isReviewRequired() {
        return reviewRequired;
    }

    public boolean isLowConfidence() {
        return lowConfidence;
    }

    public boolean isNoAnswer() {
        return noAnswer;
    }

    public Integer getRetrievalAttempts() {
        return retrievalAttempts;
    }

    public Double getTotalDurationMs() {
        return totalDurationMs;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public JsonNode getRequest() {
        return request;
    }

    public JsonNode getResponse() {
        return response;
    }
}
