package com.digitalhuman.backend_java.dto;

public class RagReviewActionRequest {

    private String action;
    private String reviewedAnswer;
    private String comment;

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getReviewedAnswer() {
        return reviewedAnswer;
    }

    public void setReviewedAnswer(String reviewedAnswer) {
        this.reviewedAnswer = reviewedAnswer;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }
}
