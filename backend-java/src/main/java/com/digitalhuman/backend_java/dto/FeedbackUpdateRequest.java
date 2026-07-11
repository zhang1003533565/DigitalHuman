package com.digitalhuman.backend_java.dto;

public record FeedbackUpdateRequest(String status, String category, String adminNote) {
}
