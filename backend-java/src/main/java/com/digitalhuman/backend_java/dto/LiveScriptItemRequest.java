package com.digitalhuman.backend_java.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LiveScriptItemRequest(
        @NotBlank String title,
        @NotBlank String content,
        @NotNull @Min(1000) @Max(600000) Long durationMs,
        Integer sortOrder,
        Boolean enabled
) {}
