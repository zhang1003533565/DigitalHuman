package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;

public class RagTraceSummaryDto {

    private final String traceId;
    private final String sessionId;
    private final String status;
    private final String question;
    private final String answerPreview;
    private final String rewrittenQuestion;
    private final boolean reviewRequired;
    private final boolean lowConfidence;
    private final boolean noAnswer;
    private final Integer retrievalAttempts;
    private final Double totalDurationMs;
    private final LocalDateTime createdAt;

    public RagTraceSummaryDto(
            String traceId,
            String sessionId,
            String status,
            String question,
            String answerPreview,
            String rewrittenQuestion,
            boolean reviewRequired,
            boolean lowConfidence,
            boolean noAnswer,
            Integer retrievalAttempts,
            Double totalDurationMs,
            LocalDateTime createdAt) {
        this.traceId = traceId;
        this.sessionId = sessionId;
        this.status = status;
        this.question = question;
        this.answerPreview = answerPreview;
        this.rewrittenQuestion = rewrittenQuestion;
        this.reviewRequired = reviewRequired;
        this.lowConfidence = lowConfidence;
        this.noAnswer = noAnswer;
        this.retrievalAttempts = retrievalAttempts;
        this.totalDurationMs = totalDurationMs;
        this.createdAt = createdAt;
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

    public String getAnswerPreview() {
        return answerPreview;
    }

    public String getRewrittenQuestion() {
        return rewrittenQuestion;
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
}
