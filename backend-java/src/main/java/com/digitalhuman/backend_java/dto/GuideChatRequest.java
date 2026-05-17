package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.NotBlank;

public class GuideChatRequest {

    private String sessionId;

    @NotBlank(message = "问题不能为空")
    private String question;

    private String interest;

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
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
}
