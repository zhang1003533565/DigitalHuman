package com.digitalhuman.backend_java.dto;

public class RagQueryRequest {

    private final String question;
    private final String interest;
    private final Integer topK;

    public RagQueryRequest(String question, String interest, Integer topK) {
        this.question = question;
        this.interest = interest;
        this.topK = topK;
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
}
