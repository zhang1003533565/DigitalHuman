package com.digitalhuman.backend_java.dto;

public class GuideMessageDto {

    private final String role;
    private final String content;
    private final long timestamp;

    public GuideMessageDto(String role, String content, long timestamp) {
        this.role = role;
        this.content = content;
        this.timestamp = timestamp;
    }

    public String getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    public long getTimestamp() {
        return timestamp;
    }
}
