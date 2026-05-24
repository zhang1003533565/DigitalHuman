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
    private final String reviewStatus;
    private final String reviewedAnswer;
    private final String reviewComment;
    private final String promptVersion;
    private final String providerStatus;
    private final String providerError;
    private final Boolean feedbackHelpful;
    private final Integer feedbackRating;
    private final String feedbackComment;
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
            String reviewStatus,
            String reviewedAnswer,
            String reviewComment,
            String promptVersion,
            String providerStatus,
            String providerError,
            Boolean feedbackHelpful,
            Integer feedbackRating,
            String feedbackComment,
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
        this.reviewStatus = reviewStatus;
        this.reviewedAnswer = reviewedAnswer;
        this.reviewComment = reviewComment;
        this.promptVersion = promptVersion;
        this.providerStatus = providerStatus;
        this.providerError = providerError;
        this.feedbackHelpful = feedbackHelpful;
        this.feedbackRating = feedbackRating;
        this.feedbackComment = feedbackComment;
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

    public String getReviewStatus() {
        return reviewStatus;
    }

    public String getReviewedAnswer() {
        return reviewedAnswer;
    }

    public String getReviewComment() {
        return reviewComment;
    }

    public String getPromptVersion() {
        return promptVersion;
    }

    public String getProviderStatus() {
        return providerStatus;
    }

    public String getProviderError() {
        return providerError;
    }

    public Boolean getFeedbackHelpful() {
        return feedbackHelpful;
    }

    public Integer getFeedbackRating() {
        return feedbackRating;
    }

    public String getFeedbackComment() {
        return feedbackComment;
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
