package com.digitalhuman.backend_java.dto;

import java.time.LocalDateTime;

public class FeedbackRecordDto {
    private final Long id;
    private final String sessionId;
    private final String traceId;
    private final String routeId;
    private final Long messageId;
    private final String question;
    private final String answer;
    private final boolean helpful;
    private final int rating;
    private final String comment;
    private final String status;
    private final String category;
    private final String adminNote;
    private final LocalDateTime createdAt;

    public FeedbackRecordDto(Long id, String sessionId, String traceId, String routeId, Long messageId,
            String question, String answer, boolean helpful, int rating, String comment,
            String status, String category, String adminNote, LocalDateTime createdAt) {
        this.id = id;
        this.sessionId = sessionId;
        this.traceId = traceId;
        this.routeId = routeId;
        this.messageId = messageId;
        this.question = question;
        this.answer = answer;
        this.helpful = helpful;
        this.rating = rating;
        this.comment = comment;
        this.status = status;
        this.category = category;
        this.adminNote = adminNote;
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }
    public String getSessionId() { return sessionId; }
    public String getTraceId() { return traceId; }
    public String getRouteId() { return routeId; }
    public Long getMessageId() { return messageId; }
    public String getQuestion() { return question; }
    public String getAnswer() { return answer; }
    public boolean isHelpful() { return helpful; }
    public int getRating() { return rating; }
    public String getComment() { return comment; }
    public String getStatus() { return status; }
    public String getCategory() { return category; }
    public String getAdminNote() { return adminNote; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
