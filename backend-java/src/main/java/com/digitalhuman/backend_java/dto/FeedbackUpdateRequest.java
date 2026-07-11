package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.Size;

public record FeedbackUpdateRequest(String status, String category, @Size(max = 1000) String adminNote) {
}
