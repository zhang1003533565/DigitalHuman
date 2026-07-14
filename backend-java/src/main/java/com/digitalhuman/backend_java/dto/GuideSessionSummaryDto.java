package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;

public class GuideSessionSummaryDto {
    private final String sessionId;
    private final long messageCount;
    private final long knowledgeHitCount;
    private final String latestQuestion;
    private final String latestAnswer;
    private final LocalDateTime createdAt;
    private final LocalDateTime updatedAt;

    public GuideSessionSummaryDto(String sessionId, long messageCount, long knowledgeHitCount,
            String latestQuestion, String latestAnswer, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.sessionId = sessionId;
        this.messageCount = messageCount;
        this.knowledgeHitCount = knowledgeHitCount;
        this.latestQuestion = latestQuestion;
        this.latestAnswer = latestAnswer;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getSessionId() { return sessionId; }
    public long getMessageCount() { return messageCount; }
    public long getKnowledgeHitCount() { return knowledgeHitCount; }
    public String getLatestQuestion() { return latestQuestion; }
    public String getLatestAnswer() { return latestAnswer; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
