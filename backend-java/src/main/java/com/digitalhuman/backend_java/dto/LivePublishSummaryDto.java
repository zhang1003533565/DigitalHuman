package com.digitalhuman.backend_java.dto;

import java.time.Instant;

public record LivePublishSummaryDto(Long versionId, Instant publishedAt, Long totalDurationMs, Integer itemCount) {}
