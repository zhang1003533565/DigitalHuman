package com.digitalhuman.backend_java.dto;

public record VisitorLiveItemDto(
        Long itemId,
        String title,
        String content,
        Long durationMs,
        Integer sortOrder
) {}
