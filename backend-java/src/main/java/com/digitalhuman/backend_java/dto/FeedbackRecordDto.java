package com.digitalhuman.backend_java.dto;

public class FeedbackRecordDto {

    private final String sessionId;
    private final String traceId;
    private final String question;
    private final String answer;
    private final boolean helpful;
    private final int rating;
    private final String comment;
    private final long timestamp;

    public FeedbackRecordDto(String sessionId, String traceId, String question, String answer, boolean helpful, int rating, String comment, long timestamp) {
        this.sessionId = sessionId;
        this.traceId = traceId;
        this.question = question;
        this.answer = answer;
        this.helpful = helpful;
        this.rating = rating;
        this.comment = comment;
        this.timestamp = timestamp;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getQuestion() {
        return question;
    }

    public String getAnswer() {
        return answer;
    }

    public boolean isHelpful() {
        return helpful;
    }

    public int getRating() {
        return rating;
    }

    public String getComment() {
        return comment;
    }

    public long getTimestamp() {
        return timestamp;
    }
}
