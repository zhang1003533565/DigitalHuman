package com.digitalhuman.backend_java.dto;

public class RagQueryRequest {

    private final String question;
    private final String interest;
    private final Integer topK;
    private final String sessionId;
    private final String traceId;

    public RagQueryRequest(String question, String interest, Integer topK, String sessionId, String traceId) {
        this.question = question;
        this.interest = interest;
        this.topK = topK;
        this.sessionId = sessionId;
        this.traceId = traceId;
    }

    public String getQuestion() {
        return question;
    }

    public String getInterest() {
        return interest;
    }

    public Integer getTopK() {
        return topK;
    }

    public String getSessionId() {
        return sessionId;
    }

    public String getTraceId() {
        return traceId;
    }
}
