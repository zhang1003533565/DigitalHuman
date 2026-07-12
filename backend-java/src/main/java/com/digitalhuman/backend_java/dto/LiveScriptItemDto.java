package com.digitalhuman.backend_java.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record LiveScriptItemDto(
        Long id,
        String title,
        String content,
        Long durationMs,
        Integer sortOrder,
        Boolean enabled,
        Instant updatedAt
) {}
